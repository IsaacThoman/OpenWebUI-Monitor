'use client'

import { useState, useEffect } from 'react'
import { Input } from 'antd'
import { Button } from '@/components/ui/button'
import { CheckOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import { toast } from 'sonner'

interface EditableCellProps {
    value: number
    isEditing: boolean
    onEdit: () => void
    onSubmit: (value: number) => Promise<void>
    onCancel: () => void
    t: (key: string, options?: { max?: number }) => string
    disabled?: boolean
    tooltipText?: string
    placeholder?: string
    validateValue?: (value: number) => {
        isValid: boolean
        errorMessage?: string
        maxValue?: number
    }
    isPerMsgPrice?: boolean
}

export function EditableCell({
    value,
    isEditing,
    onEdit,
    onSubmit,
    onCancel,
    t,
    disabled = false,
    tooltipText,
    placeholder,
    validateValue = (value) => ({ isValid: true }),
    isPerMsgPrice = false,
}: EditableCellProps) {
    const numericValue = typeof value === 'number' ? value : Number(value)
    const originalValue = numericValue >= 0 ? numericValue.toFixed(4) : ''
    const [inputValue, setInputValue] = useState(originalValue)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (isEditing) {
            setInputValue(originalValue)
        }
    }, [isEditing, originalValue])

    useEffect(() => {
        if (isEditing) {
            const handleClickOutside = (e: MouseEvent) => {
                const target = e.target as HTMLElement
                if (!target.closest('.editable-cell-input')) {
                    onCancel()
                }
            }

            document.addEventListener('mousedown', handleClickOutside)
            return () => {
                document.removeEventListener('mousedown', handleClickOutside)
            }
        }
    }, [isEditing, onCancel])

    const handleSubmit = async () => {
        try {
            setIsSaving(true)
            const numValue = Number(inputValue)
            const validation = validateValue(numValue)

            if (!validation.isValid) {
                toast.error(validation.errorMessage || t('error.invalidInput'))
                return
            }

            if (
                validation.maxValue !== undefined &&
                numValue > validation.maxValue
            ) {
                toast.error(
                    t('error.exceedsMaxValue', { max: validation.maxValue })
                )
                return
            }

            await onSubmit(numValue)
        } catch (err) {
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className={`relative ${disabled ? 'opacity-50' : ''}`}>
            {isEditing ? (
                <div className="relative editable-cell-input flex items-center gap-1.5">
                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        className="
              !w-[calc(100%-32px)]
              !border
              !border-border
              hover:!border-ring
              focus:!border-ring
              !bg-background
              !shadow-none
              !px-2
              !py-1
              !h-7
              flex-1
              !rounded-none
              !text-foreground
              !text-sm
              !font-medium
              placeholder:!text-muted-foreground
            "
                        placeholder={placeholder || t('common.enterValue')}
                        onPressEnter={handleSubmit}
                        autoFocus
                        disabled={isSaving}
                    />
                    <Button
                        size="sm"
                        variant="ghost"
                        className={`
              h-7 w-7
              flex-shrink-0
              border
              border-border
              bg-muted
              text-foreground
              transition-colors
              p-0
              flex
              items-center
              justify-center
              hover:bg-muted/80
              ${isSaving ? 'cursor-not-allowed opacity-70' : ''}
            `}
                        onClick={(e) => {
                            e.stopPropagation()
                            handleSubmit()
                        }}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <div className="w-3 h-3 border-2 border-foreground/60 border-t-transparent animate-spin" />
                        ) : (
                            <CheckOutlined className="text-xs" />
                        )}
                    </Button>
                </div>
            ) : (
                <div
                    onClick={disabled ? undefined : onEdit}
                    className={`
            group
            px-2
            py-1
            transition-colors
            ${
                disabled
                    ? 'cursor-not-allowed line-through'
                    : 'cursor-pointer hover:bg-muted/30'
            }
          `}
                >
                    <span
                        className={`
              font-medium
              text-sm
              transition-colors
              duration-200
              ${
                  disabled
                      ? 'text-muted-foreground/60'
                      : 'text-foreground group-hover:text-foreground'
              }
             `}
                    >
                        {isPerMsgPrice && numericValue < 0 ? (
                            <span className="text-muted-foreground/60">
                                {t('common.notSet')}
                            </span>
                        ) : (
                            <>
                                {numericValue.toFixed(4)}
                                {tooltipText && (
                                    <Tooltip title={tooltipText}>
                                        <InfoCircleOutlined className="ml-1 text-muted-foreground/60" />
                                    </Tooltip>
                                )}
                            </>
                        )}
                    </span>
                </div>
            )}
        </div>
    )
}
