import { type levelColor } from "./definitions";

export function getAllTopics() {
    const topics = [];

    for (const key of Object.keys(localStorage)) {
        const value = JSON.parse(localStorage.getItem(key) as string);

        const { id, title } = value;

        topics.push({ id, title });
    }

    return topics;
}

export const levelColors: levelColor[] = [
    "red",
    "rgb(21, 255, 0)",
    "rgb(255, 251, 0)",
    "rgb(0, 255, 242)",
    "rgb(0, 89, 255)",
    "rgb(183, 0, 255)",
];
