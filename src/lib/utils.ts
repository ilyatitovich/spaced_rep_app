import type {
    TopicItem,
    levelColor,
    Topic,
    LevelId,
    Card,
} from "./definitions";
import { DayOfWeekModel } from "./models";

export function getTopicsList(): TopicItem[] {
    const topics = [];

    for (const key of Object.keys(localStorage)) {
        const { id, title } = JSON.parse(localStorage.getItem(key)!) as Topic;
        topics.push({ id, title });
    }

    return topics;
}

export async function getTopic(id: string) {
    const topic: Topic = await JSON.parse(localStorage.getItem(id) as string);
    return topic;
}

export async function getLevelCards(topicId: string, levelId: LevelId) {
    const topic: Topic = await JSON.parse(
        localStorage.getItem(topicId) as string
    );
    const levelCards: Card[] = topic.levels[Number(levelId) - 1].cards;
    return levelCards;
}

export async function getCard(
    topic: Topic,
    levelId: LevelId,
    cardIndx: number
) {
    const card: Card = topic.levels[Number(levelId) - 1].cards[cardIndx];
    return card;
}

export async function getDraftCards(topicId: string) {
    const topic: Topic = await JSON.parse(
        localStorage.getItem(topicId) as string
    );
    const draftCards: Card[] = topic.draft;
    return draftCards;
}

export async function getDraftCard(topic: Topic, cardIndx: number) {
    const draftCard: Card = topic.draft[cardIndx];
    return draftCard;
}

export async function updateWeek(topic: Topic): Promise<Topic> {
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

    topic.isUpdated = true;

    localStorage.setItem(id, JSON.stringify(topic));

    return await getTopic(id);
}

export async function resetIsUpdated(topic: Topic): Promise<Topic> {
    const { id } = topic;
    topic.isUpdated = false;

    localStorage.setItem(id, JSON.stringify(topic));
    return await getTopic(id);
}

export const letters = ["S", "M", "T", "W", "T", "F", "S"];

export const levelColors: levelColor[] = [
    "red",
    "rgb(21, 255, 0)",
    "rgb(255, 251, 0)",
    "rgb(0, 255, 242)",
    "rgb(0, 89, 255)",
    "rgb(183, 0, 255)",
    "rgb(89, 0, 255)",
];
