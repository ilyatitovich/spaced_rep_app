import {
    type levelColor,
    type Card,
    type Level,
    type DayOfWeek,
    type Topic,
} from "./definitions";
import { levelColors } from "./utils";

export class LevelModel implements Level {
    id: number;
    color: levelColor;
    cards: Card[];

    constructor(id: number, color: levelColor) {
        this.id = id;
        this.color = color;
        this.cards = [];
    }
}

export class DayOfWeekModel implements DayOfWeek {
    date: number;
    todayLevels: number[];
    isDone: boolean;

    constructor(date: number) {
        this.date = date;
        this.todayLevels = [0];
        this.isDone = false;
    }

    setLevelList(pivot: number) {
        const numOfDays = Math.floor((this.date - pivot) / 86400000 + 1);

        const levelConditions = [
            { divisor: 2, level: 1 },
            { divisor: 5, level: 2 },
            { divisor: 9, level: 3 },
            { divisor: 17, level: 4 },
            { divisor: 33, level: 5 },
            { divisor: 65, level: 6 },
        ];

        levelConditions.forEach((condition) => {
            if (numOfDays % condition.divisor === 0) {
                this.todayLevels.push(condition.level);
            }
        });
    }
}

export class TopicModel implements Topic {
    id: string;
    title: string;
    pivot: number;
    week: Array<DayOfWeek | null>;
    draft: Card[];
    levels: Level[];
    nextUpdateDate: number;

    constructor(id: string, title: string, nextUpdateDate: number) {
        this.id = id;
        this.title = title;
        this.pivot = Date.now();
        this.week = this.setStartWeek(this.pivot);
        this.draft = [];
        this.levels = this.createLevelsList(levelColors);
        this.nextUpdateDate = nextUpdateDate;
    }

    setStartWeek(timestamp: number) {
        const week: Array<DayOfWeek | null> = [];
        const dayOfTheWeek = new Date(timestamp).getDay();

        for (let d = 0; d < 7; d++) {
            if (dayOfTheWeek > d) {
                week.push(null);
            } else {
                const day = new DayOfWeekModel(
                    timestamp + 86400000 * (d - dayOfTheWeek)
                );
                day.setLevelList(timestamp);
                week.push(day);
            }
        }

        return week;
    }

    createLevelsList(colors: levelColor[]) {
        return colors.map((color, index) => new LevelModel(index + 1, color));
    }
}
