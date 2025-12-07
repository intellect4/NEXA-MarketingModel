
// This service mocks email functionality.

export const initGoogleAuth = (callback: (response: any) => void, clientId?: string) => {
    return true;
};

// Simplified to just sending. No inbox fetching required as per new requirement.
export const sendGmail = async (to: string, subject: string, body: string, pdfBase64?: string) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // In a real app, this would call a backend endpoint that uses Nodemailer or an API (SendGrid/Resend)
    // Here we just return success to simulate the "sent" state.
    
    // We log it for debugging
    console.log(`[Mock Email Service] Sending to: ${to}`);
    console.log(`[Mock Email Service] Attachment Present: ${!!pdfBase64}`);

    return {
        id: `msg_${Date.now()}`,
        threadId: `thread_${Date.now()}`,
        labelIds: ['SENT']
    };
};
