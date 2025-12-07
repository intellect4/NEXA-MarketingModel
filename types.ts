
export interface CompanyProfile {
  companyName?: string;
  description: string;
  contactEmail: string;
  location: {
    country: string;
    regions: string[]; 
    cities: string[]; 
  };
  targetIndustries: string[]; 
}

export interface PotentialClient {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  description: string;
  industry: string;
  status: 'Generated' | 'Emailed' | 'Saved' | 'Replied';
}

export interface ClientSearchResult {
    clients: PotentialClient[];
    suggestedLocations: string[];
    found: boolean;
}

export interface OutreachEmail {
  subject: string;
  body: string;
}

export interface PortfolioContent {
  title: string;
  introduction: string;
  services: { name: string; description: string }[];
  callToAction: string;
  designTheme: {
    palette: string;
    fontStyle: string;
  };
}

export interface OutreachMaterials {
  email: OutreachEmail;
  portfolio: PortfolioContent;
}

export interface HistoryLog {
    id: number;
    message: string;
    timestamp: string;
    icon: 'sparkles' | 'airplane' | 'archive' | 'profile' | 'check' | 'mail' | 'clock' | 'lightbulb';
}

export interface SentEmail {
    id: string;
    to: string;
    subject: string;
    body: string;
    timestamp: string;
    from: string;
}

export interface EmailMessage {
    id: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    timestamp: string;
    isReply: boolean;
    attachments?: string[];
}

export interface EmailThread {
    id: string; // Internal ID
    gmailThreadId?: string; // Real Gmail Thread ID
    clientId: string;
    clientName: string;
    subject: string;
    messages: EmailMessage[];
    unread: boolean;
    aiSummary?: string;
    lastUpdated: number;
}

export interface User {
    name: string;
    email: string;
    avatar: string;
    accessToken?: string;
    isAuthenticated: boolean;
}
