import { useEffect, useRef, useState } from 'react';
import './BirthDatePicker.css';
import { BIRTH_DATE_YEAR_RANGE, CALENDAR_MONTH_LABELS, CALENDAR_WEEKDAY_LABELS, YEAR_PICKER_PAGE_SIZE } from './BirthDatePicker.consts';
import type { CalendarDay, BirthDatePickerProps, PickerView } from './BirthDatePicker.types';

const toDateValue = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const getDateFromValue = (value: string): Date => new Date(`${value}T00:00:00`);

const isSameDay = (left: Date, right: Date): boolean => toDateValue(left) === toDateValue(right);

const getCalendarDays = (monthDate: Date): CalendarDay[] => {
    const firstDayOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const calendarStart = new Date(firstDayOfMonth);
    calendarStart.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay());

    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(calendarStart);
        date.setDate(calendarStart.getDate() + index);

        return {
            date,
            isCurrentMonth: date.getMonth() === monthDate.getMonth(),
        };
    });
};

const formatSelectedDate = (value: string): string => {
    if (!value) {
        return 'Select your date of birth';
    }

    return new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(getDateFromValue(value));
};

const getMonthLabel = (date: Date): string => new Intl.DateTimeFormat(undefined, { month: 'long' }).format(date);

const getPreviousMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth() - 1, 1);

const getNextMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth() + 1, 1);

export const BirthDatePicker = ({ value, onChange }: BirthDatePickerProps) => {
    const today = new Date();
    const selectedDate = value ? getDateFromValue(value) : null;
    const pickerRef = useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [pickerView, setPickerView] = useState<PickerView>('days');
    const [visibleMonth, setVisibleMonth] = useState(() =>
        selectedDate ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 1),
    );
    const [yearPageStart, setYearPageStart] = useState(() =>
        today.getFullYear() - (today.getFullYear() % YEAR_PICKER_PAGE_SIZE),
    );
    const calendarDays = getCalendarDays(visibleMonth);
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const isNextMonthDisabled = visibleMonth.getTime() >= currentMonth.getTime();
    const earliestSelectableYear = today.getFullYear() - BIRTH_DATE_YEAR_RANGE;
    const availableYears = Array.from({ length: YEAR_PICKER_PAGE_SIZE }, (_, index) => yearPageStart + index);
    const canGoToPreviousYearPage = yearPageStart > earliestSelectableYear;
    const canGoToNextYearPage = yearPageStart + YEAR_PICKER_PAGE_SIZE <= today.getFullYear();

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const handlePointerDown = (event: PointerEvent): void => {
            if (!(event.target instanceof Node) || pickerRef.current?.contains(event.target)) {
                return;
            }

            setIsOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [isOpen]);

    const handleOpen = (): void => {
        if (selectedDate) {
            setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
        }
        const currentYear = (selectedDate ?? today).getFullYear();
        setYearPageStart(currentYear - (currentYear % YEAR_PICKER_PAGE_SIZE));
        setPickerView('days');
        setIsOpen(true);
    };

    const handleYearChange = (year: number): void => {
        const selectedMonth = year === today.getFullYear() ? Math.min(visibleMonth.getMonth(), today.getMonth()) : visibleMonth.getMonth();
        setVisibleMonth(new Date(year, selectedMonth, 1));
    };

    const handleYearSelection = (year: number): void => {
        handleYearChange(year);
        setPickerView('months');
    };

    const handleDateSelection = (date: Date): void => {
        if (date.getTime() > today.getTime()) {
            return;
        }

        onChange(toDateValue(date));
        setIsOpen(false);
    };

    const handleMonthSelection = (month: number): void => {
        const selectedMonth = new Date(visibleMonth.getFullYear(), month, 1);
        if (selectedMonth.getTime() > currentMonth.getTime()) {
            return;
        }

        setVisibleMonth(selectedMonth);
        setPickerView('days');
    };

    return (
        <div ref={pickerRef} className="birth-date-picker">
            <button
                className="birth-date-picker__trigger"
                type="button"
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                onClick={handleOpen}
            >
                <span className={value ? 'birth-date-picker__value' : 'birth-date-picker__placeholder'}>{formatSelectedDate(value)}</span>
                <span className="birth-date-picker__calendar-icon" aria-hidden="true" />
            </button>

            {isOpen && (
                <div className="birth-date-picker__panel" role="dialog" aria-label="Choose your date of birth">
                    <div className="birth-date-picker__header">
                        <button
                            className="birth-date-picker__nav-button"
                            type="button"
                            aria-label={pickerView === 'years' ? 'Previous years' : 'Previous month'}
                            disabled={pickerView === 'years' && !canGoToPreviousYearPage}
                            onClick={() => {
                                if (pickerView === 'years') {
                                    setYearPageStart(yearPageStart - YEAR_PICKER_PAGE_SIZE);
                                    return;
                                }

                                setVisibleMonth(getPreviousMonth(visibleMonth));
                            }}
                        >
                            ‹
                        </button>
                        <div className="birth-date-picker__month-controls">
                            <button
                                className={`birth-date-picker__month-button${pickerView === 'months' ? ' birth-date-picker__month-button--active' : ''}`}
                                type="button"
                                aria-pressed={pickerView === 'months'}
                                onClick={() => setPickerView('months')}
                            >
                                {getMonthLabel(visibleMonth)}
                            </button>
                            <button
                                className={`birth-date-picker__year-button${pickerView === 'years' ? ' birth-date-picker__year-button--active' : ''}`}
                                type="button"
                                aria-pressed={pickerView === 'years'}
                                onClick={() => {
                                    setYearPageStart(visibleMonth.getFullYear() - (visibleMonth.getFullYear() % YEAR_PICKER_PAGE_SIZE));
                                    setPickerView('years');
                                }}
                            >
                                {visibleMonth.getFullYear()}
                            </button>
                        </div>
                        <button
                            className="birth-date-picker__nav-button"
                            type="button"
                            aria-label={pickerView === 'years' ? 'Next years' : 'Next month'}
                            disabled={pickerView === 'years' ? !canGoToNextYearPage : isNextMonthDisabled}
                            onClick={() => {
                                if (pickerView === 'years') {
                                    setYearPageStart(yearPageStart + YEAR_PICKER_PAGE_SIZE);
                                    return;
                                }

                                setVisibleMonth(getNextMonth(visibleMonth));
                            }}
                        >
                            ›
                        </button>
                    </div>

                    {pickerView === 'days' && (
                        <>
                            <div className="birth-date-picker__weekdays" aria-hidden="true">
                                {CALENDAR_WEEKDAY_LABELS.map((weekday) => <span key={weekday}>{weekday}</span>)}
                            </div>
                            <div className="birth-date-picker__days">
                                {calendarDays.map(({ date, isCurrentMonth }) => {
                                    const isFutureDate = date.getTime() > today.getTime();
                                    const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
                                    const isToday = isSameDay(date, today);

                                    return (
                                        <button
                                            key={toDateValue(date)}
                                            className={`birth-date-picker__day${!isCurrentMonth ? ' birth-date-picker__day--outside' : ''}${isSelected ? ' birth-date-picker__day--selected' : ''}${isToday ? ' birth-date-picker__day--today' : ''}`}
                                            type="button"
                                            disabled={isFutureDate}
                                            aria-label={new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(date)}
                                            aria-pressed={isSelected}
                                            onClick={() => handleDateSelection(date)}
                                        >
                                            {date.getDate()}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {pickerView === 'months' && (
                        <div className="birth-date-picker__month-grid" aria-label="Select month">
                            {CALENDAR_MONTH_LABELS.map((monthLabel, month) => {
                                const isFutureMonth = new Date(visibleMonth.getFullYear(), month, 1).getTime() > currentMonth.getTime();
                                const isSelectedMonth = visibleMonth.getMonth() === month;

                                return (
                                    <button
                                        key={monthLabel}
                                        className={`birth-date-picker__month-option${isSelectedMonth ? ' birth-date-picker__month-option--selected' : ''}`}
                                        type="button"
                                        disabled={isFutureMonth}
                                        aria-pressed={isSelectedMonth}
                                        onClick={() => handleMonthSelection(month)}
                                    >
                                        {monthLabel}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {pickerView === 'years' && (
                        <div className="birth-date-picker__month-grid" aria-label="Select year">
                            {availableYears.map((year) => {
                                const isUnavailableYear = year > today.getFullYear() || year < earliestSelectableYear;
                                const isSelectedYear = visibleMonth.getFullYear() === year;

                                return (
                                    <button
                                        key={year}
                                        className={`birth-date-picker__month-option${isSelectedYear ? ' birth-date-picker__month-option--selected' : ''}`}
                                        type="button"
                                        disabled={isUnavailableYear}
                                        aria-pressed={isSelectedYear}
                                        onClick={() => handleYearSelection(year)}
                                    >
                                        {year}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div className="birth-date-picker__footer">
                        <button type="button" onClick={() => onChange('')}>Clear</button>
                        <button type="button" onClick={() => setIsOpen(false)}>Done</button>
                    </div>
                </div>
            )}
        </div>
    );
};
