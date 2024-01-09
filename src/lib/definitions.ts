export type levelColor =
    | "red"
    | "rgb(21, 255, 0)"
    | "rgb(255, 251, 0)"
    | "rgb(0, 255, 242)"
    | "rgb(0, 89, 255)"
    | "rgb(183, 0, 255)";

export interface Card {
    id: number;
    front: string;
    back: string;
}

export interface Level {
    id: number;
    color: levelColor;
    cards: Card[];
}

export interface DayOfWeek {
    date: number;
    todayLevels: number[];
    isDone: boolean;
}

export interface Topic {
    id: string;
    title: string;
    pivot: number;
    week: Array<DayOfWeek | null>;
    levels: Level[];
}
