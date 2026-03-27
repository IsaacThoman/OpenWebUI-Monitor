"""
title: Usage Monitor Button (v2)
author: VariantConst & OVINC CN (ported w/ button)
version: 0.4.0
icon_url: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAACMElEQVR4nO2ZMWgUQRSGJ4mFgZBGQTAgCqawSbASg6YIFkEsPbCQHNzd/v/sHBe4IvUSUtqlThcCSZEiXUharWxURC20SDCQIGKMxjTBk4E7MhlO7naX3M7C/PCamZud9817M/NuVwgvLy8vZ0VylOQ6ySOSjR7bEYA1kiNpnP+egeMNy74lgmiufMMRW00CkEXaNP5jh0kAzj1E9FhMO78HSCn6CDBeDsbdmM5FgB7gvHwEmPE9kFoeIGvRp1B6AXgOAEqpoVxGAMCenhvAjdiDPUAKlcvlayQJ4FczArO1Wm04FxEAUCV53O6vJYBppwGklKUONdWJlPKukwBRFF0iuW/NuwLgpdkGYMtJAAD3rTnXW2AAvhjtp9Vq9YqLAAVrpecMXxatvknnAEg+tZycb/VJKZ+R3G4ZgAfOAYRhOGYBHJC8mfiBGZxCfSQ/WhBfpZRPEj0to2P0Ybs7AMCmUup2Li6yIAgmrFOnBfFH74Vc1ELFYvGyPoWaL3ZNP05JPs5TMXcVwIYViU96v3Qz+GfcVyVxLE40SL43x4ZheKcbgLVeApD8bazyG6tvwRrfOY30R4U2OXiRAJ+N/h9RFPUbi/nCHBsEwSPRjUql0nX9ceEi0qkNwLL1mxndXq/XBwF8MPsqlcot4ZqklFMWwF+SrwDsWu2vhasCsNQhcicA7glXVSgUBnQRZ25oY2O/1SW3yIOUUkMAKk3nd0iOi7wpPKtO32XtSyJ1C/APUWkkXC3hgzUAAAAASUVORK5CYII=
required_open_webui_version: 0.4.0
requirements: pydantic
license: MIT
"""

import os
import json
from typing import Optional
from pydantic import BaseModel, Field

TRANSLATIONS = {
    "en": {
        "no_assistant": "No assistant message found",
        "no_message_id": "Unable to get message ID",
        "no_record": "No billing record found for this message",
        "read_failed": "Failed to read the stats file: {err}",
        "cost": "Cost: ${cost:.6f}",
        "balance": "Balance: ${balance:.6f}",
        "tokens": "Tokens: {input}+{output}",
        "time": "Time: {elapsed:.2f}s",
        "tps": "{tps:.2f} T/s",
    },
    "zh": {
        "no_assistant": "没有找到assistant消息",
        "no_message_id": "无法获取消息ID",
        "no_record": "未查找到该消息的计费记录，请联系管理员",
        "read_failed": "读取统计文件失败: {err}",
        "cost": "费用: ¥{cost:.6f}",
        "balance": "余额: ¥{balance:.6f}",
        "tokens": "Token: {input}+{output}",
        "time": "耗时: {elapsed:.2f}s",
        "tps": "{tps:.2f} T/s",
    },
}


class Action:
    class Valves(BaseModel):
        language: str = Field(
            default="zh",
            description="language (en/zh)",
            json_schema_extra={"ui:group": "显示设置"},
        )
        show_cost: bool = Field(
            default=True,
            description="是否显示费用 / Show cost",
            json_schema_extra={"ui:group": "显示设置"},
        )
        show_balance: bool = Field(
            default=True,
            description="是否显示余额 / Show balance",
            json_schema_extra={"ui:group": "显示设置"},
        )
        show_tokens: bool = Field(
            default=True,
            description="是否显示token数 / Show tokens",
            json_schema_extra={"ui:group": "显示设置"},
        )
        show_time_spent: bool = Field(
            default=True,
            description="是否显示耗时 / Show time spent",
            json_schema_extra={"ui:group": "显示设置"},
        )
        show_tokens_per_sec: bool = Field(
            default=True,
            description="是否显示每秒输出token数 / Show output tokens/sec",
            json_schema_extra={"ui:group": "显示设置"},
        )

    def __init__(self):
        self.valves = self.Valves()

    @staticmethod
    def _record_dir() -> str:
        return "/app/backend/data/record"

    def _t(self, key: str, **kwargs) -> str:
        lang = self.valves.language if self.valves.language in TRANSLATIONS else "en"
        text = TRANSLATIONS[lang].get(key, TRANSLATIONS["en"][key])
        return text.format(**kwargs) if kwargs else text

    async def action(
        self,
        body: dict,
        user: Optional[dict] = None,
        __event_emitter__=None,
        __event_call__=None,
    ) -> Optional[dict]:
        """
        Reads /app/backend/data/record/{last_assistant_message_id}.json
        and pushes a one-line status to the UI.
        """
        # Locate last assistant message
        messages = body.get("messages", [])
        assistant_indexes = [
            i for i, m in enumerate(messages) if m.get("role") == "assistant"
        ]
        if not assistant_indexes:
            if __event_emitter__:
                await __event_emitter__(
                    {
                        "type": "status",
                        "data": {"description": self._t("no_assistant"), "done": True},
                    }
                )
            return None

        last_assistant = messages[assistant_indexes[-1]]
        message_id = last_assistant.get("id")
        if not message_id:
            if __event_emitter__:
                await __event_emitter__(
                    {
                        "type": "status",
                        "data": {"description": self._t("no_message_id"), "done": True},
                    }
                )
            return None

        # Read record
        file_path = os.path.join(self._record_dir(), f"{message_id}.json")
        if not os.path.exists(file_path):
            if __event_emitter__:
                await __event_emitter__(
                    {
                        "type": "status",
                        "data": {"description": self._t("no_record"), "done": True},
                    }
                )
            return None

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                stats = json.load(f)
        except Exception as e:
            if __event_emitter__:
                await __event_emitter__(
                    {
                        "type": "status",
                        "data": {
                            "description": self._t("read_failed", err=str(e)),
                            "done": True,
                        },
                    }
                )
            return None

        parts = []

        if (
            self.valves.show_tokens
            and "input_tokens" in stats
            and "output_tokens" in stats
        ):
            parts.append(
                self._t(
                    "tokens", input=stats["input_tokens"], output=stats["output_tokens"]
                )
            )

        if self.valves.show_cost and "total_cost" in stats:
            parts.append(self._t("cost", cost=stats["total_cost"]))

        if self.valves.show_balance and "new_balance" in stats:
            parts.append(self._t("balance", balance=stats["new_balance"]))

        if self.valves.show_time_spent and "elapsed_time" in stats:
            elapsed = stats["elapsed_time"]
            parts.append(self._t("time", elapsed=elapsed))

            if (
                self.valves.show_tokens_per_sec
                and "output_tokens" in stats
                and elapsed
                and elapsed > 0
            ):
                tps = stats["output_tokens"] / elapsed
                parts.append(self._t("tps", tps=tps))

        line = " | ".join(parts)

        if __event_emitter__:
            await __event_emitter__(
                {
                    "type": "status",
                    "data": {"description": line, "done": True},
                }
            )

        return None
