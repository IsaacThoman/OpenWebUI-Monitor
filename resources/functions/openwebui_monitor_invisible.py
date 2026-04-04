"""
title: OpenWebUI Monitor (Invisible, v2)
author: VariantConst & OVINC CN (ported to invisible+button pair)
version: 0.4.2
requirements: httpx, pydantic
license: MIT
"""

import asyncio
import copy
import time
import os
import json
import logging
from typing import Dict, Optional, Callable, Any, Awaitable
from pydantic import BaseModel, Field
from httpx import AsyncClient, ReadTimeout, TimeoutException

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

TRANSLATIONS = {
    "en": {
        "request_failed": "Request failed: {error_msg}",
        "insufficient_balance": "Insufficient balance: Current balance `{balance:.4f}`",
        "api_auth_failed": "API key authentication failed",
        "missing_message_id": "Unable to get message ID",
        "written_stats": "Usage stats written for message {message_id}",
        "timeout_error": "Monitor request timed out after {timeout}s - proceeding without usage tracking",
    },
    "zh": {
        "request_failed": "请求失败: {error_msg}",
        "insufficient_balance": "余额不足: 当前余额 `{balance:.4f}`",
        "api_auth_failed": "API密钥验证失败",
        "missing_message_id": "无法获取消息ID",
        "written_stats": "已写入消息 {message_id} 的计费统计",
        "timeout_error": "监控请求超时 ({timeout}秒) - 继续运行但不记录使用量",
    },
}


class CustomException(Exception):
    pass


class Filter:
    class Valves(BaseModel):
        api_endpoint: str = Field(default="", description="openwebui-monitor base URL")
        api_key: str = Field(default="", description="openwebui-monitor API key")
        priority: int = Field(default=5, description="Filter priority")
        language: str = Field(default="zh", description="language (en/zh)")

    def __init__(self):
        self.type = "filter"
        self.name = "OpenWebUI Monitor (Invisible v2)"
        self.valves = self.Valves()
        self.outage_map: Dict[str, bool] = {}
        self.start_time: Optional[float] = None
        # Keep a deep copy of inlet body to stitch if needed (rare)
        self._inlet_snapshot: Optional[dict] = None

    # ----------------------------
    # Helpers
    # ----------------------------
    def _t(self, key: str, **kwargs) -> str:
        lang = self.valves.language if self.valves.language in TRANSLATIONS else "en"
        text = TRANSLATIONS[lang].get(key, TRANSLATIONS["en"][key])
        return text.format(**kwargs) if kwargs else text

    async def _request(
        self, client: AsyncClient, url: str, headers: dict, json_data: dict, timeout: float = 3.0
    ):
        # Robust JSON-ify (pydantic models etc.)
        json_data = json.loads(
            json.dumps(
                json_data, default=lambda o: o.dict() if hasattr(o, "dict") else str(o)
            )
        )
        resp = await client.post(url=url, headers=headers, json=json_data, timeout=timeout)
        if resp.status_code == 401:
            # Let caller decide how to surface auth failures
            raise CustomException(self._t("api_auth_failed"))
        resp.raise_for_status()
        data = resp.json()
        if not data.get("success"):
            raise CustomException(self._t("request_failed", error_msg=data))
        return data

    @staticmethod
    def _find_last_assistant_id(messages: list) -> Optional[str]:
        last_assistant = None
        for m in messages:
            if m.get("role") == "assistant":
                last_assistant = m
        return last_assistant.get("id") if last_assistant else None

    @staticmethod
    def _record_dir() -> str:
        return "/app/backend/data/record"

    @staticmethod
    def _as_int(value: Any) -> Optional[int]:
        if value is None or isinstance(value, bool):
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _normalize_reasoning_billed_output_tokens(self, node: Any) -> int:
        """
        Normalize providers that report visible completion_tokens separately from
        reasoning_tokens while billing output as:
            total_tokens - prompt_tokens

        Example fixed by this:
        - prompt_tokens = 145
        - completion_tokens = 333
        - reasoning_tokens = 2163
        - total_tokens = 2641
        => billed output tokens should be 2496, not 333
        """
        fixed = 0

        if isinstance(node, dict):
            prompt_tokens = self._as_int(node.get("prompt_tokens"))
            completion_tokens = self._as_int(node.get("completion_tokens"))
            total_tokens = self._as_int(node.get("total_tokens"))

            completion_details = node.get("completion_tokens_details")
            reasoning_tokens = None
            if isinstance(completion_details, dict):
                reasoning_tokens = self._as_int(
                    completion_details.get("reasoning_tokens")
                )

            if (
                prompt_tokens is not None
                and completion_tokens is not None
                and total_tokens is not None
                and reasoning_tokens is not None
                and reasoning_tokens > 0
            ):
                billed_output_tokens = total_tokens - prompt_tokens
                # Only rewrite when reasoning is clearly excluded from completion_tokens
                # and the billed output is exactly completion + reasoning.
                if (
                    billed_output_tokens > 0
                    and billed_output_tokens != completion_tokens
                    and billed_output_tokens == completion_tokens + reasoning_tokens
                ):
                    node["completion_tokens"] = billed_output_tokens
                    node["output_tokens"] = billed_output_tokens
                    fixed += 1

            for value in node.values():
                fixed += self._normalize_reasoning_billed_output_tokens(value)

        elif isinstance(node, list):
            for item in node:
                fixed += self._normalize_reasoning_billed_output_tokens(item)

        return fixed

    # ----------------------------
    # Filter lifecycle
    # ----------------------------
    async def inlet(
        self, body: dict, __user__: Optional[dict] = None, **kwargs
    ) -> dict:
        """
        Start-of-request hook:
        - Calls /api/v1/inlet
        - Checks balance (per-user outage gate)
        - Starts timer
        - Snapshots inlet body (optional)
        """
        self.start_time = time.time()
        self._inlet_snapshot = copy.deepcopy(body)
        __user__ = __user__ or {}
        user_id = __user__.get("id", "default")
        client = AsyncClient()
        try:
            data = await self._request(
                client=client,
                url=f"{self.valves.api_endpoint}/api/v1/inlet",
                headers={"Authorization": f"Bearer {self.valves.api_key}"},
                json_data={"user": __user__, "body": body},
            )
            # Gate by balance
            self.outage_map[user_id] = data.get("balance", 0) <= 0
            if self.outage_map[user_id]:
                raise CustomException(
                    self._t("insufficient_balance", balance=data.get("balance", 0))
                )
            return body
        except CustomException as ce:
            logger.exception(ce)
            # Propagate to stop generation when outage/401/etc.
            raise
        except Exception as err:
            # Check if this is a timeout error
            err_msg = str(err).lower()
            is_timeout = (
                isinstance(err, (ReadTimeout, TimeoutException)) or
                "timeout" in err_msg or 
                "readtimeout" in err_msg
            )
            if is_timeout:
                logger.error(
                    "usage_monitor(invisible): inlet request timed out after 3s - proceeding without balance check"
                )
                # Don't raise on timeout - allow the chat to proceed
                return body
            logger.exception(self._t("request_failed", error_msg=err))
            # Wrap as generic error (visible in UI)
            raise Exception(f"error calculating usage, {err}") from err
        finally:
            await client.aclose()

    async def outlet(
        self,
        body: dict,
        __user__: Optional[dict] = None,
        __event_emitter__: Optional[Callable[[Any], Awaitable[None]]] = None,
        **kwargs,
    ) -> dict:
        """
        End-of-response hook:
        - Calls /api/v1/outlet with retries (non-blocking)
        - Persists usage stats to /app/backend/data/record/{message_id}.json
        """
        __user__ = __user__ or {}
        user_id = __user__.get("id", "default")

        # If inlet determined outage, skip accounting
        if self.outage_map.get(user_id, False):
            return body

        # Build request with stitched inlet snapshot if OWUI trimmed messages
        body_for_outlet = copy.deepcopy(body)
        if (
            body.get("messages")
            and self._inlet_snapshot
            and self._inlet_snapshot.get("messages")
        ):
            try:
                if "info" not in body["messages"][-1]:
                    body_for_outlet["messages"][:-1] = self._inlet_snapshot[
                        "messages"
                    ]
            except Exception:
                pass

        # Normalize providers like Grok/xAI that expose reasoning tokens separately
        normalized_count = self._normalize_reasoning_billed_output_tokens(
            body_for_outlet
        )
        if normalized_count:
            logger.info(
                "usage_monitor(invisible): normalized %d reasoning-billed usage payload(s)",
                normalized_count,
            )

        # Extract API-provided cost from the message if available
        api_cost = None
        try:
            messages = body_for_outlet.get("messages", [])
            if messages:
                last_message = messages[-1]
                if last_message.get("info") and isinstance(last_message["info"], dict):
                    info = last_message["info"]
                    if info.get("usage") and isinstance(info["usage"], dict):
                        usage = info["usage"]
                        if "cost" in usage and usage["cost"] is not None:
                            api_cost = float(usage["cost"])
                            logger.info(
                                "usage_monitor(invisible): found API cost in message.info.usage: %f",
                                api_cost,
                            )
                    if api_cost is None and "cost" in info and info["cost"] is not None:
                        api_cost = float(info["cost"])
                        logger.info(
                            "usage_monitor(invisible): found API cost in message.info: %f",
                            api_cost,
                        )
                if api_cost is None and last_message.get("usage") and isinstance(last_message["usage"], dict):
                    usage = last_message["usage"]
                    if "cost" in usage and usage["cost"] is not None:
                        api_cost = float(usage["cost"])
                        logger.info(
                            "usage_monitor(invisible): found API cost in message.usage: %f",
                            api_cost,
                        )
        except (ValueError, TypeError, AttributeError) as e:
            logger.warning("usage_monitor(invisible): failed to parse API cost: %s", e)

        # Retry logic for outlet (non-blocking, can afford to wait)
        max_retries = 3
        base_timeout = 30.0
        
        for attempt in range(max_retries):
            client = AsyncClient()
            try:
                timeout = base_timeout * (attempt + 1)  # Increase timeout each retry
                logger.info(
                    "usage_monitor(invisible): outlet attempt %d/%d with %.1fs timeout",
                    attempt + 1,
                    max_retries,
                    timeout
                )
                
                result = await self._request(
                    client=client,
                    url=f"{self.valves.api_endpoint}/api/v1/outlet",
                    headers={"Authorization": f"Bearer {self.valves.api_key}"},
                    json_data={"user": __user__, "body": body_for_outlet, "apiCost": api_cost},
                    timeout=timeout,
                )
                
                # Success - process result
                input_tokens = result["inputTokens"]
                output_tokens = result["outputTokens"]
                total_cost = result["totalCost"]
                new_balance = result["newBalance"]

                # Identify message id to key the record
                messages = body.get("messages", [])
                message_id = self._find_last_assistant_id(messages) or (
                    messages[-1].get("id") if messages else None
                )
                if not message_id:
                    if __event_emitter__:
                        await __event_emitter__(
                            {
                                "type": "status",
                                "data": {
                                    "description": self._t("missing_message_id"),
                                    "done": True,
                                },
                            }
                        )
                    return body

                # Build stats record
                stats = {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_cost": total_cost,
                    "new_balance": new_balance,
                }
                if self.start_time:
                    elapsed = time.time() - self.start_time
                    stats["elapsed_time"] = elapsed
                    stats["tokens_per_sec"] = (
                        (output_tokens / elapsed) if elapsed > 0 else 0.0
                    )

                # Persist to /app/backend/data/record/{message_id}.json
                rec_dir = self._record_dir()
                os.makedirs(rec_dir, exist_ok=True)
                file_path = os.path.join(rec_dir, f"{message_id}.json")
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(stats, f, ensure_ascii=False, indent=4)

                logger.info(
                    "usage_monitor(invisible): wrote %s (attempt %d/%d)",
                    file_path,
                    attempt + 1,
                    max_retries
                )
                return body
                
            except (ReadTimeout, TimeoutException) as te:
                logger.error(
                    "usage_monitor(invisible): outlet timeout on attempt %d/%d (%.1fs): %s",
                    attempt + 1,
                    max_retries,
                    timeout,
                    str(te)
                )
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
                    logger.info(
                        "usage_monitor(invisible): waiting %ds before retry...",
                        wait_time
                    )
                    await asyncio.sleep(wait_time)
                else:
                    # Final attempt failed
                    logger.error(
                        "usage_monitor(invisible): outlet failed after %d attempts - usage stats not recorded",
                        max_retries
                    )
                    if __event_emitter__:
                        await __event_emitter__(
                            {
                                "type": "status",
                                "data": {
                                    "description": self._t("timeout_error", timeout=int(timeout)),
                                    "done": True,
                                },
                            }
                        )
                    
            except CustomException as ce:
                # Surface auth failures as a status line instead of raising
                if __event_emitter__:
                    await __event_emitter__(
                        {"type": "status", "data": {"description": str(ce), "done": True}}
                    )
                return body
                
            except Exception as err:
                logger.exception(
                    "usage_monitor(invisible): outlet error on attempt %d/%d: %s",
                    attempt + 1,
                    max_retries,
                    str(err)
                )
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    logger.info(
                        "usage_monitor(invisible): waiting %ds before retry...",
                        wait_time
                    )
                    await asyncio.sleep(wait_time)
                else:
                    # Final attempt failed
                    if __event_emitter__:
                        await __event_emitter__(
                            {
                                "type": "status",
                                "data": {
                                    "description": self._t(
                                        "request_failed", error_msg=str(err)
                                    ),
                                    "done": True,
                                },
                            }
                        )
                    return body
            finally:
                await client.aclose()
        
        # Should never reach here, but return body just in case
        return body
