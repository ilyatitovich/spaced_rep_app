import { ReactNode } from "react";
import "./NavBar.scss";

interface NavBarProps {
    justifyContent: "center" | "space-between"
    children: ReactNode;
}

export default function NavBar({justifyContent, children}:NavBarProps) {
    return (
        <nav className="nav" style={{justifyContent: justifyContent}}>{children}</nav>
    );
}