import "./Error404.scss";
import { Link } from "react-router-dom";

export default function Error404() {
    return (
        <div className="screen error">
            <div className="content">
                <div className="code">404 - Page Not Found</div>
                <div className="message">Oops! It looks like you've taken a wrong turn.</div>
                <div>Go back to <Link to="/">Start screen</Link></div>
            </div>
        </div>
    );
}