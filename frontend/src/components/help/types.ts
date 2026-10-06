export interface HelpArticle {
  id: string;
  title: string;
  category: string;
  content: string;
  videoUrl?: string;
  role?: string[];
  tags: string[];
  lastUpdated: string;
}

export interface HelpCategory {
  id: string;
  label: string;
  icon: any;
  color: string;
  description: string;
}

export interface HelpSystemProps {
  isOpen: boolean;
  onClose: () => void;
  contextualTopic?: string;
}
