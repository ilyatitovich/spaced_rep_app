import "./Button.scss";
import { Link } from "react-router-dom";

interface ButtonProps {
    title: string;
    asLink?: true;
    to?: string;
    testBtn?: "correct" | "wrong";
    handleClick?: () => void;
}

export default function Button({
    title,
    asLink,
    to = "",
    testBtn,
    handleClick,
}: ButtonProps) {
    if (asLink) {
        return <Link to={to}>{title}</Link>;
    }

    return (
        <button className={testBtn} onClick={handleClick}>
            {title}
        </button>
    );
}
