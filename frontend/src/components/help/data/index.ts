import { HelpArticle } from '../types';
import { gettingStartedArticles } from './gettingStartedArticles';
import { settingsArticles } from './settingsArticles';
import { posArticles } from './posArticles';
import { inventoryArticles } from './inventoryArticles';

// Combine all articles from different categories
export const allHelpArticles: HelpArticle[] = [
  ...gettingStartedArticles,
  ...settingsArticles,
  ...posArticles,
  ...inventoryArticles,
];

// Export individual category articles for easier access
export {
  gettingStartedArticles,
  settingsArticles,
  posArticles,
  inventoryArticles,
};
