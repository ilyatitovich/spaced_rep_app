import "./DayOfWeek.scss";
import { levelColors } from "../../lib/utils";


export default function DayOfWeek() {
    const boxesList = levelColors.map((bgColor) => (
        <div key={bgColor} className="box" style={{ backgroundColor: bgColor }}></div>
    ));

    return (
        <div className="day">
            <p className="letter"></p>
            <div className="state-container">
                <div className="state"></div>
            </div>
            {boxesList}
        </div>
    );
}
