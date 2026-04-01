import React, { useState } from "react";
import api from "../lib/api";

const formatTimestamp = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleString();
};

const TicketConversation = ({
  ticket,
  canReply,
  placeholder,
  messages,
  loading,
  isOpen,
  onToggle,
  onMessagesLoaded,
  onTicketUpdated,
}) => {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const openConversation = async () => {
    onToggle(ticket._id);
  };

  const submitReply = async (e) => {
    e.preventDefault();

    const message = draft.trim();
    if (!message) {
      return;
    }

    setSending(true);
    try {
      const response = await api.post(`/api/tickets/${ticket._id}/reply`, { message });
      setDraft("");
      onMessagesLoaded(ticket._id, response.data.messages || []);
      if (response.data.ticket) {
        onTicketUpdated(response.data.ticket);
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="conversation-block">
      <div className="conversation-head">
        <strong>Conversation</strong>
        <button type="button" onClick={openConversation}>
          {isOpen ? "Hide Conversation" : "Show Conversation"}
        </button>
      </div>

      {isOpen && (
        <>
          <div className="conversation-thread">
            {loading && <p><small>Loading conversation...</small></p>}
            {!loading && (!messages || messages.length === 0) && (
              <p><small>No replies yet.</small></p>
            )}
            {!loading && (messages || []).map((entry) => {
              const isCustomer = entry.senderRole === "user";

              return (
                <div
                  key={entry._id || `${entry.createdAt}-${entry.message}`}
                  className={`chat-message ${isCustomer ? "chat-left" : "chat-right"}`}
                >
                  <div className="chat-bubble">
                    <strong>{entry.sender?.name || entry.senderRole}</strong>
                    <p>{entry.message}</p>
                    <small>{formatTimestamp(entry.createdAt)}</small>
                  </div>
                </div>
              );
            })}
          </div>

          {canReply && (
            <form className="conversation-form" onSubmit={submitReply}>
              <textarea
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={placeholder}
              />
              <button type="submit" disabled={sending}>
                {sending ? "Sending..." : "Send Reply"}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
};

export default TicketConversation;
