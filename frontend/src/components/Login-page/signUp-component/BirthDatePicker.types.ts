export interface BirthDatePickerProps {
    value: string;
    onChange: (value: string) => void;
}

export interface CalendarDay {
    date: Date;
    isCurrentMonth: boolean;
}

export type PickerView = 'days' | 'months' | 'years';
