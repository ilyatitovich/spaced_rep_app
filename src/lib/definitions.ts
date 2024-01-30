export type levelColor =
    | "red"
    | "rgb(21, 255, 0)"
    | "rgb(255, 251, 0)"
    | "rgb(0, 255, 242)"
    | "rgb(0, 89, 255)"
    | "rgb(183, 0, 255)"
    | "rgb(89, 0, 255)";

export type LevelId = "draft" | "0" | "1" | "2" | "3" | "4" | "5" | "6";

export interface TopicItem {
    id: string;
    title: string;
}

export interface Card {
    id: number;
    level: number;
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
    draft: Card[];
    levels: Level[];
    nextUpdateDate: number;
}
