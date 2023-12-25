export function getAllTopics() {
    const topics = [];

    for (const key of Object.keys(localStorage)) {

        const value = JSON.parse(localStorage.getItem(key) as string);

        const {id, title} = value;

        topics.push({id, title})
    }

    return topics;
}