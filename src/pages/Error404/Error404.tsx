import "./Error404.scss";
import { Link } from "react-router-dom";

export default function Error404() {
    return (
        <div className="error">
            <div className="content">
                <div className="code">404 - Page Not Found</div>
                <small className="message">Oops! It looks like you've taken a wrong turn.</small>
                <div className="link">Go back to <Link to="/">Start screen</Link></div>
            </div>
        </div>
    );
}