from app.session_store import load_all_sessions, init_db
init_db()
sessions: dict = load_all_sessions()