import type { ExportedChatConversation, ExportedChatTurn, Message } from './chat.types';

const appendChatTurn = (turns: readonly ExportedChatTurn[], message: Message): readonly ExportedChatTurn[] => {
    if (message.role === 'system') {
        return turns;
    }

    if (message.role === 'user') {
        return [...turns, { user: message.content, chatbot: '' }];
    }

    const previousTurn = turns[turns.length - 1];
    if (previousTurn && previousTurn.chatbot.length === 0) {
        return [...turns.slice(0, -1), { ...previousTurn, chatbot: message.content }];
    }

    return [...turns, { user: '', chatbot: message.content }];
};

export const buildChatJsonExport = (
    conversationId: string,
    messages: readonly Message[]
): ExportedChatConversation => ({
    id: conversationId,
    chat: messages.reduce<readonly ExportedChatTurn[]>(appendChatTurn, []),
});

export const formatChatJsonExport = (conversationId: string, messages: readonly Message[]): string =>
    JSON.stringify(buildChatJsonExport(conversationId, messages), null, 2);
