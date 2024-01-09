import "./TopicsList.scss";


export default function TopicsList({topics}: {topics: { id: string; title: string; }[]}) {
    let content;

    console.log(topics)

    if (topics.length > 0) {
        content = (
            <ul>
                {topics.map((item) => (
                    <a key={item.title} href={`topic/${item.id}`} className="item">{item.title}</a>
                ))}
            </ul>
        );
    } else {
        content = "No topics to study yet.";
    }

    return <div className="topics-list">{content}</div>;
}
