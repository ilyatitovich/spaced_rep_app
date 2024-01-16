import { ReactNode } from "react";
import "./Button.scss";
import { Link } from "react-router-dom";

interface ButtonProps {
    asLink?: true;
    to?: string;
    testBtn?: "correct" | "wrong";
    handleClick?: () => void;
    children: ReactNode;
}

export default function Button({
    asLink,
    to = "",
    testBtn,
    handleClick,
    children,
}: ButtonProps) {
    if (asLink) {
        return (
            <Link to={to} onClick={handleClick}>
                {children}
            </Link>
        );
    }

    return (
        <button className={testBtn} onClick={handleClick}>
            {children}
        </button>
    );
}
