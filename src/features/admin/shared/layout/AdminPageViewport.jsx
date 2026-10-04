export default function AdminPageViewport({ chrome = null, children }) {
    return (
        <div className="geo-main min-h-0">
            {chrome}
            <div className="geo-content flex-1 overflow-y-auto">{children}</div>
        </div>
    );
}
