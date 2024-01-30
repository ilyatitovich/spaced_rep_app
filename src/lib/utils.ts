import type {
    TopicItem,
    levelColor,
    Topic,
    LevelId,
    Card,
} from "./definitions";
import { DayOfWeekModel } from "./models";

export function saveTopic(topic: Topic) {
    localStorage.setItem(topic.id, JSON.stringify(topic));
}

export function getTopicsList(): TopicItem[] {
    return Object.values(localStorage).map((topic) => {
        const { id, title } = JSON.parse(topic) as Topic;
        return { id, title };
    });
}

export function getTopic(id: string) {
    return JSON.parse(localStorage.getItem(id)!);
}

export function getLevelCards(topicId: string, levelId: LevelId): Card[] {
    const topic: Topic = JSON.parse(localStorage.getItem(topicId)!);

    if (levelId === "draft") {
        return topic.draft;
    } else {
        return topic.levels[Number(levelId) - 1].cards;
    }
}

export function getCard(
    topic: Topic,
    levelId: LevelId,
    cardIndx: number
): Card {
    if (levelId === "draft") {
        return topic.draft[cardIndx];
    } else {
        return topic.levels[Number(levelId) - 1].cards[cardIndx];
    }
}

export function updateWeek(topic: Topic): Topic {
    const dayOfTheWeek = new Date().getDay();

    const { id, pivot } = topic;

    topic.week = [];

    for (let d = 0; d < 7; d++) {
        const day = new DayOfWeekModel(
            Date.now() + 86400000 * (d - dayOfTheWeek)
        );
        day.setLevelList(pivot);
        topic.week.push(day);
    }

    topic.nextUpdateDate = getNextUpdateDate();

    saveTopic(topic);

    return getTopic(id);
}

export function getNextUpdateDate(): number {
    const today = new Date();
    const currentDayOfWeek = today.getDay();

    // Calculate the number of days until the next Sunday
    const daysUntilSunday = 7 - currentDayOfWeek;

    // Set the date to the next Sunday
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilSunday);

    // Set the time to midnight (00:00:00)
    nextSunday.setHours(0, 0, 0, 0);

    // Return the timestamp for the next Sunday at midnight
    return nextSunday.getTime();
}

export const levelColors: levelColor[] = [
    "red",
    "rgb(21, 255, 0)",
    "rgb(255, 251, 0)",
    "rgb(0, 255, 242)",
    "rgb(0, 89, 255)",
    "rgb(183, 0, 255)",
    "rgb(89, 0, 255)",
];
