import { v4 as uuidv4 } from "uuid";

export interface Card {
    id: number;
    front: string;
    back: string;
}

export class Box {
    id: number;
    cards: Card[];

    constructor(id: number) {
        this.id = id;
        this.cards = [];
    }
}

export class DayOfWeek {
    date: number;
    todayBoxes: number[];
    isDone: boolean;

    constructor(date: number) {
        this.date = date;
        this.todayBoxes = [0];
        this.isDone = false;
    }

    setLevelList(pivot: number) {
        const numOfDays = Math.floor((this.date - pivot) / 86400000 + 1);
        if (numOfDays % 2 === 0) this.todayBoxes.push(1);
        if (numOfDays % 4 === 0) this.todayBoxes.push(2);
        if (numOfDays % 8 === 0) this.todayBoxes.push(3);
        if (numOfDays % 16 === 0) this.todayBoxes.push(4);
        if (numOfDays % 32 === 0) this.todayBoxes.push(5);
        if (numOfDays % 64 === 0) this.todayBoxes.push(6);
    }
}

export class Topic {
    id: string;
    title: string;
    pivot: number;
    week: Array<DayOfWeek | null>;
    boxesList: Box[];

    constructor(title: string) {
        this.id = uuidv4();
        this.title = title;
        this.pivot = Date.now();
        this.week = [];
        this.boxesList = this.createBoxesList();
    }

    setStartWeek() {
        const dayOfTheWeek = new Date().getDay();

        for (let d = 1; d < 8; d++) {
            if (dayOfTheWeek > d) {
                this.week.push(null);
            } else {
                const day = new DayOfWeek(
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
            const day = new DayOfWeek(Date.now() + 86400000 * d);
            day.setLevelList(this.pivot);
            this.week.push(day);
        }
    }

    createBoxesList() {
        const list: Box[] = [];

        for (let i = 1; i < 8; i++) {
            list.push(new Box(i));
        }

        return list;
    }
}
