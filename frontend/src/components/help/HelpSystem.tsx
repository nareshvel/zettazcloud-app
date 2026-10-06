import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Book, ChevronRight, Clock, Bookmark, ThumbsUp, ThumbsDown, ExternalLink, Info } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { HelpSystemProps, HelpArticle } from './types';
import { helpCategories } from './data/categories';
import { allHelpArticles } from './data';
import ArticleRenderer from './ArticleRenderer';

const HelpSystem: React.FC<HelpSystemProps> = ({ isOpen, onClose, contextualTopic }) => {
  const { } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('getting-started');
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);

  // Get filtered articles based on search and category
  const filteredArticles = allHelpArticles.filter(article => {
    const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory;
    const matchesSearch = searchTerm === '' || 
      article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesCategory && matchesSearch;
  });

  // Handle contextual topic selection
  useEffect(() => {
    if (contextualTopic && isOpen) {
      const contextualArticle = allHelpArticles.find(article => 
        article.tags.includes(contextualTopic) || article.category === contextualTopic
      );
      if (contextualArticle) {
        setSelectedArticle(contextualArticle);
        setSelectedCategory(contextualArticle.category);
      }
    }
  }, [contextualTopic, isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-6xl h-full max-h-[90vh] flex overflow-hidden border border-gray-200 dark:border-border relative" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-gray-100 dark:bg-muted hover:bg-gray-200 dark:bg-muted rounded-full flex items-center justify-center transition-colors duration-200"
          aria-label="Close help"
        >
          <X className="w-4 h-4 text-gray-600 dark:text-muted-foreground" />
        </button>
        
        {/* Sidebar */}
        <div className="w-72 bg-gradient-to-b from-gray-50 to-gray-100 border-r border-gray-200 dark:border-border flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-border bg-white dark:bg-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mr-3">
                  <Book className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground">Help Center</h2>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-muted-foreground" />
              <input
                type="text"
                placeholder="Search help articles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {helpCategories.map((category) => {
                const IconComponent = category.icon;
                const articleCount = allHelpArticles.filter(article => article.category === category.id).length;
                
                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategory(category.id);
                      setSelectedArticle(null);
                    }}
                    className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                      selectedCategory === category.id
                        ? 'bg-blue-100 border-blue-200 shadow-sm'
                        : 'hover:bg-white dark:bg-card hover:shadow-sm border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${category.color}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-foreground text-sm">{category.label}</div>
                          <div className="text-xs text-gray-500 dark:text-muted-foreground">{category.description}</div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span className="text-xs bg-gray-200 dark:bg-muted text-gray-600 dark:text-muted-foreground px-2 py-1 rounded-full">
                          {articleCount}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-400 dark:text-muted-foreground ml-2 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Breadcrumb */}
          <div className="p-4 border-b border-gray-200 dark:border-border bg-white dark:bg-card">
            <div className="flex items-center text-sm text-gray-600 dark:text-muted-foreground">
              <span>Help Center</span>
              <ChevronRight className="w-4 h-4 mx-2" />
              <span className="capitalize">
                {helpCategories.find(cat => cat.id === selectedCategory)?.label || selectedCategory}
              </span>
              {selectedArticle && (
                <>
                  <ChevronRight className="w-4 h-4 mx-2" />
                  <span className="text-gray-900 dark:text-foreground font-medium">{selectedArticle.title}</span>
                </>
              )}
            </div>
          </div>

          {selectedArticle ? (
            <>
              {/* Article Header */}
              <div className="p-6 border-b border-gray-200 dark:border-border bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-3">
                      <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mr-4">
                        <Book className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground mb-1">
                          {selectedArticle.title}
                        </h1>
                        <div className="flex items-center text-sm text-gray-600 dark:text-muted-foreground space-x-4">
                          <div className="flex items-center">
                            <Clock size={14} className="mr-1" />
                            <span>Updated {selectedArticle.lastUpdated}</span>
                          </div>
                          {selectedArticle.videoUrl && (
                            <a
                              href={selectedArticle.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center text-primary hover:text-primary font-medium transition-colors"
                            >
                              <Info size={14} className="mr-1" />
                              Watch Video
                            </a>
                          )}
                          <button className="flex items-center text-gray-600 dark:text-muted-foreground hover:text-primary transition-colors">
                            <Bookmark size={14} className="mr-1" />
                            Bookmark
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 ml-4">
                    {selectedArticle.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-white dark:bg-card text-primary px-3 py-2 rounded-full font-medium shadow-sm border border-blue-200"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Article Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto p-6">
                  <ArticleRenderer content={selectedArticle.content} />
                </div>
              </div>

              {/* Article Footer */}
              <div className="p-6 border-t border-gray-200 dark:border-border bg-gradient-to-r from-gray-50 to-blue-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-gray-700 dark:text-foreground">Was this helpful?</span>
                    <div className="flex items-center space-x-2">
                      <button className="flex items-center px-3 py-2 text-sm text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors">
                        <ThumbsUp size={14} className="mr-1" />
                        Yes
                      </button>
                      <button className="flex items-center px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
                        <ThumbsDown size={14} className="mr-1" />
                        No
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button className="flex items-center px-4 py-2 text-sm text-primary hover:text-primary hover:bg-blue-100 rounded-lg transition-colors font-medium">
                      <ExternalLink size={14} className="mr-1" />
                      Share Feedback
                    </button>
                    <button className="flex items-center px-4 py-2 text-sm bg-primary text-white hover:bg-primary/90 rounded-lg transition-colors font-medium">
                      <Info size={14} className="mr-1" />
                      Contact Support
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 p-6">
              <div className="grid gap-4">
                {filteredArticles.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => setSelectedArticle(article)}
                    className="text-left p-4 rounded-lg border border-gray-200 dark:border-border hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-foreground mb-2 group-hover:text-primary">
                          {article.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-muted-foreground mb-3 line-clamp-2">
                          {article.content.substring(0, 120).replace(/[#*]/g, '')}...
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {article.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-xs bg-gray-100 dark:bg-muted text-gray-600 dark:text-muted-foreground px-2 py-1 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ChevronRight size={16} className="ml-4 text-gray-400 dark:text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </button>
                ))}
                {filteredArticles.length === 0 && (
                  <div className="text-center py-12">
                    <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-foreground mb-2">No articles found</h3>
                    <p className="text-gray-500 dark:text-muted-foreground">Try selecting a different category or adjusting your search terms</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default HelpSystem;
