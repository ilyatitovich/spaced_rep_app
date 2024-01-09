import { v4 as uuidv4 } from "uuid";
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
        if (numOfDays % 2 === 0) this.todayLevels.push(1);
        if (numOfDays % 4 === 0) this.todayLevels.push(2);
        if (numOfDays % 8 === 0) this.todayLevels.push(3);
        if (numOfDays % 16 === 0) this.todayLevels.push(4);
        if (numOfDays % 32 === 0) this.todayLevels.push(5);
        if (numOfDays % 64 === 0) this.todayLevels.push(6);
    }
}

export class TopicModel implements Topic {
    id: string;
    title: string;
    pivot: number;
    week: Array<DayOfWeek | null>;
    levels: LevelModel[];

    constructor(title: string) {
        this.id = uuidv4();
        this.title = title;
        this.pivot = Date.now();
        this.week = [];
        this.levels = this.createBoxesList();
    }

    setStartWeek() {
        const dayOfTheWeek = new Date().getDay();

        for (let d = 1; d < 8; d++) {
            if (dayOfTheWeek > d) {
                this.week.push(null);
            } else {
                const day = new DayOfWeekModel(
                    this.pivot + 86400000 * (d - dayOfTheWeek)
                );
                day.setLevelList(this.pivot);
                this.week.push(day);
            }
        }
    }

    updateWeek() {
        this.week = [];
        for (let d = 0; d < 7; d++) {
            const day = new DayOfWeekModel(Date.now() + 86400000 * d);
            day.setLevelList(this.pivot);
            this.week.push(day);
        }
    }

    createBoxesList() {
        const list: Level[] = [];

        for (let i = 1; i < 8; i++) {
            list.push(new LevelModel(i, levelColors[i - 1]));
        }

        return list;
    }
}
