import React from 'react';
import { ChevronRight, Lightbulb, Code, AlertTriangle } from 'lucide-react';

interface ArticleRendererProps {
  content: string;
}

const ArticleRenderer: React.FC<ArticleRendererProps> = ({ content }) => {
  const renderInlineFormatting = (text: string) => {
    // Convert **bold** to actual bold formatting
    return text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-800 dark:text-foreground">$1</strong>');
  };

  const renderArticleContent = (content: string) => {
    const sections = content.split('\n\n').filter(section => section.trim());
    
    return (
      <div className="space-y-3">
        {sections.map((section, index) => {
          const trimmedSection = section.trim();
          
          // Heading with emoji
          if (trimmedSection.match(/^# .* [🎉💳📊⚙️🌍📦]/)) {
            const match = trimmedSection.match(/^# (.*) ([🎉💳📊⚙️🌍📦])/);
            return (
              <div key={index} className="mb-4">
                <div className="flex items-center mb-3">
                  <div className="w-6 h-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mr-2">
                    <span className="text-sm">{match?.[2]}</span>
                  </div>
                  <h1 className="text-lg font-medium text-gray-800 dark:text-foreground font-inter">{match?.[1]}</h1>
                </div>
              </div>
            );
          }
          
          // Regular main heading
          if (trimmedSection.startsWith('# ')) {
            return (
              <h1 key={index} className="text-3xl font-bold text-gray-900 dark:text-foreground mb-6 pb-3 border-b-2 border-blue-200">
                {trimmedSection.substring(2)}
              </h1>
            );
          }
          
          // Sub-heading with arrow
          // Only treat as a standalone sub-heading if it's just a single heading line with no additional content.
          // If there is additional content (e.g., numbered or bullet lists), let later branches handle the combined section.
          if (trimmedSection.startsWith('##') && !trimmedSection.includes('\n')) {
            const title = trimmedSection.replace(/^## /, '');
            return (
              <div key={index} className="mb-3">
                <div className="flex items-center mb-2">
                  <ChevronRight className="w-3 h-3 text-primary mr-2" />
                  <h2 className="text-base font-medium text-gray-700 dark:text-foreground font-inter">{title}</h2>
                </div>
              </div>
            );
          }
          
          // Code block
          if (trimmedSection.startsWith('```')) {
            const lines = trimmedSection.split('\n');
            const codeContent = lines.slice(1, -1).join('\n');
            return (
              <div key={index} className="mb-4">
                <div className="bg-gray-900 rounded-lg overflow-hidden shadow-md">
                  <div className="bg-gray-800 px-3 py-2 flex items-center">
                    <Code className="w-3 h-3 text-green-400 mr-2" />
                    <span className="text-xs text-gray-300 font-medium">Example</span>
                  </div>
                  <pre className="p-3 text-green-400 font-mono text-xs overflow-x-auto">
                    <code>{codeContent}</code>
                  </pre>
                </div>
              </div>
            );
          }
          
          // Mixed content with heading and bullet list (only when there are no numbered items)
          if (trimmedSection.includes('\n- ') && trimmedSection.includes('##') && !trimmedSection.match(/^\d+\./m)) {
            const lines = trimmedSection.split('\n');
            const elements = [] as React.ReactNode[];
            let currentBulletList: string[] = [];
            let currentParagraphLines: string[] = [];

            const flushBullets = (key: string) => {
              if (currentBulletList.length === 0) return;
              elements.push(
                <div key={`bullets-${key}`} className="mb-3">
                  <div className="space-y-1.5">
                    {currentBulletList.map((item, itemIndex) => {
                      const text = item.replace(/^[•-] /, '');
                      return (
                        <div key={itemIndex} className="flex items-start">
                          <div className="w-1 h-1 bg-gray-400 rounded-full mr-3 mt-2.5 flex-shrink-0"></div>
                          <p className="text-gray-600 dark:text-muted-foreground text-sm leading-6 font-inter" dangerouslySetInnerHTML={{ __html: renderInlineFormatting(text) }}></p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
              currentBulletList = [];
            };

            const flushParagraphs = (key: string) => {
              if (currentParagraphLines.length === 0) return;
              const paragraphText = currentParagraphLines.join(' ');
              elements.push(
                <div key={`para-${key}`} className="mb-2">
                  <p className="text-gray-600 dark:text-muted-foreground text-sm leading-6 font-inter" dangerouslySetInnerHTML={{ __html: renderInlineFormatting(paragraphText) }}></p>
                </div>
              );
              currentParagraphLines = [];
            };

            for (let i = 0; i < lines.length; i++) {
              const raw = lines[i];
              const line = raw.trim();

              if (line.startsWith('## ')) {
                flushBullets(`before-h-${i}`);
                flushParagraphs(`before-h-${i}`);
                const title = line.replace(/^## /, '');
                elements.push(
                  <div key={`heading-${i}`} className="mb-3">
                    <div className="flex items-center mb-2">
                      <ChevronRight className="w-3 h-3 text-primary mr-2" />
                      <h2 className="text-base font-medium text-gray-700 dark:text-foreground font-inter">{title}</h2>
                    </div>
                  </div>
                );
              } else if (line.match(/^[•-] /)) {
                // Switching to bullets, flush any paragraphs first
                flushParagraphs(`before-b-${i}`);
                currentBulletList.push(line);
              } else if (line.length > 0) {
                // Regular paragraph/explanation line
                currentParagraphLines.push(line);
              }
            }

            // Flush any remaining blocks
            flushParagraphs('end');
            flushBullets('end');

            return <div key={index}>{elements}</div>;
          }

          // Simple bullet list (only when there are no numbered items)
          if ((trimmedSection.match(/^[•-]/m) || trimmedSection.includes('\n- ')) && !trimmedSection.match(/^\d+\./m)) {
            const items = trimmedSection.split('\n').filter(line => line.trim().match(/^[•-]/));
            return (
              <div key={index} className="mb-3">
                <div className="space-y-1.5">
                  {items.map((item, itemIndex) => {
                    const text = item.trim().replace(/^[•-] /, '');
                    return (
                      <div key={itemIndex} className="flex items-start">
                        <div className="w-1 h-1 bg-gray-400 rounded-full mr-3 mt-2.5 flex-shrink-0"></div>
                        <p className="text-gray-600 dark:text-muted-foreground text-sm leading-6 font-inter" dangerouslySetInnerHTML={{ __html: renderInlineFormatting(text) }}></p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }
          
          // Numbered list with sub-items (handle the specific structure from gettingStartedArticles)
          if (trimmedSection.match(/^\d+\. \*\*.*\*\*/m)) {
            const lines = trimmedSection.split('\n');
            const items = [];
            let currentItem = null;
            
            for (const line of lines) {
              const match = line.match(/^(\d+)\. (.*)/);
              if (match) {
                // Start new numbered item
                if (currentItem) {
                  items.push(currentItem);
                }
                currentItem = {
                  number: match[1],
                  text: match[2]
                };
              } else if (currentItem && line.trim().startsWith('   -')) {
                // Sub-bullet under numbered item
                currentItem.text += '\n' + line.trim();
              } else if (currentItem && line.trim()) {
                // Continuation of numbered item
                currentItem.text += '\n' + line.trim();
              }
            }
            
            if (currentItem) {
              items.push(currentItem);
            }
            
            return (
              <div key={index} className="mb-3">
                <div className="space-y-2">
                  {items.map((item, itemIndex) => {
                    // Handle sub-bullets within numbered items
                    const parts = item.text.split('\n');
                    const mainText = parts[0];
                    const subItems = parts.slice(1).filter(part => part.startsWith('- '));
                    const otherText = parts.slice(1).filter(part => !part.startsWith('- '));
                    
                    return (
                      <div key={itemIndex} className="flex items-start">
                        <div className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-xs font-medium mr-2 mt-0.5 flex-shrink-0">
                          {item.number}
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-600 dark:text-muted-foreground text-sm leading-6 font-inter" dangerouslySetInnerHTML={{ __html: renderInlineFormatting(mainText) }}></p>
                          {otherText.length > 0 && (
                            <div className="mt-1">
                              {otherText.map((text, textIndex) => (
                                <p key={textIndex} className="text-gray-600 dark:text-muted-foreground text-sm leading-6 font-inter ml-2" dangerouslySetInnerHTML={{ __html: renderInlineFormatting(text) }}></p>
                              ))}
                            </div>
                          )}
                          {subItems.length > 0 && (
                            <div className="mt-1 ml-2 space-y-1">
                              {subItems.map((subItem, subIndex) => {
                                const subText = subItem.replace(/^- /, '');
                                return (
                                  <div key={subIndex} className="flex items-start">
                                    <div className="w-1 h-1 bg-gray-400 rounded-full mr-2 mt-2 flex-shrink-0"></div>
                                    <p className="text-gray-600 dark:text-muted-foreground text-sm leading-6 font-inter" dangerouslySetInnerHTML={{ __html: renderInlineFormatting(subText) }}></p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }
          
          // Callout boxes
          if (trimmedSection.match(/^(TIP|EXAMPLE|WARNING):/)) {
            const match = trimmedSection.match(/^(TIP|EXAMPLE|WARNING): (.*)/);
            if (match) {
              const [, type, content] = match;
              const styles = {
                TIP: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'text-yellow-600', text: 'text-yellow-700' },
                EXAMPLE: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-600', text: 'text-green-700' },
                WARNING: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-600', text: 'text-red-700' }
              };
              const style = styles[type as keyof typeof styles];
              const IconComponent = type === 'TIP' ? Lightbulb : type === 'EXAMPLE' ? Code : AlertTriangle;
              
              return (
                <div key={index} className={`mb-3 p-3 rounded-lg border ${style.bg} ${style.border}`}>
                  <div className="flex items-start">
                    <IconComponent className={`w-3 h-3 ${style.icon} mr-2 mt-1 flex-shrink-0`} />
                    <div>
                      <div className={`font-medium ${style.text} mb-1 text-xs uppercase tracking-wide`}>{type}</div>
                      <p className={`${style.text} text-sm leading-6 font-inter`} dangerouslySetInnerHTML={{ __html: renderInlineFormatting(content) }}></p>
                    </div>
                  </div>
                </div>
              );
            }
          }
          
          // Handle sections that contain both headings and numbered lists
          if (trimmedSection.includes('## ') && trimmedSection.match(/\d+\./)) {
            const lines = trimmedSection.split('\n');
            const elements = [];
            let currentNumberedList: Array<{number: string, text: string, subItems: string[]}> = [];
            
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              
              if (line.startsWith('## ')) {
                // Add any pending numbered list
                if (currentNumberedList.length > 0) {
                  elements.push(
                    <div key={`numbered-${i}`} className="mb-3">
                      <div className="space-y-2">
                        {currentNumberedList.map((item, itemIndex) => {
                          const parts = item.text.split('\n');
                          const mainText = parts[0];
                          const extraText = parts.slice(1).filter(p => p.trim() && !p.startsWith('- '));
                          return (
                            <div key={itemIndex} className="flex items-start">
                              <div className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-xs font-medium mr-2 mt-0.5 flex-shrink-0">
                                {item.number}
                              </div>
                              <div className="flex-1">
                                <p className="text-gray-600 dark:text-muted-foreground text-sm leading-6 font-inter" dangerouslySetInnerHTML={{ __html: renderInlineFormatting(mainText) }}></p>
                                {extraText.length > 0 && (
                                  <div className="mt-1 ml-2 space-y-1">
                                    {extraText.map((t, k) => (
                                      <p key={k} className="text-gray-600 dark:text-muted-foreground text-sm leading-6 font-inter" dangerouslySetInnerHTML={{ __html: renderInlineFormatting(t) }}></p>
                                    ))}
                                  </div>
                                )}
                                {item.subItems.length > 0 && (
                                  <div className="mt-1 ml-2 space-y-1">
                                    {item.subItems.map((subItem, subIndex) => (
                                      <div key={subIndex} className="flex items-start">
                                        <div className="w-1 h-1 bg-gray-400 rounded-full mr-2 mt-2 flex-shrink-0"></div>
                                        <p className="text-gray-600 dark:text-muted-foreground text-sm leading-6 font-inter" dangerouslySetInnerHTML={{ __html: renderInlineFormatting(subItem) }}></p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                  currentNumberedList = [];
                }
                
                // Add heading
                const title = line.replace(/^## /, '');
                elements.push(
                  <div key={`heading-${i}`} className="mb-3">
                    <div className="flex items-center mb-2">
                      <ChevronRight className="w-3 h-3 text-primary mr-2" />
                      <h2 className="text-base font-medium text-gray-700 dark:text-foreground font-inter">{title}</h2>
                    </div>
                  </div>
                );
              } else if (line.match(/^(\d+)\. (.*)/)) {
                const match = line.match(/^(\d+)\. (.*)/);
                if (match) {
                  currentNumberedList.push({
                    number: match[1],
                    text: match[2],
                    subItems: [] as string[]
                  });
                }
              } else if (line.match(/^\s+- /) && currentNumberedList.length > 0) {
                const subText = line.trim().replace(/^- /, '');
                currentNumberedList[currentNumberedList.length - 1].subItems.push(subText);
              } else if (currentNumberedList.length > 0 && line.length > 0) {
                // Additional explanatory text for the current numbered item
                currentNumberedList[currentNumberedList.length - 1].text += '\n' + line;
              }
            }
            
            // Add any remaining numbered list
            if (currentNumberedList.length > 0) {
              elements.push(
                <div key={`numbered-final`} className="mb-3">
                  <div className="space-y-2">
                    {currentNumberedList.map((item, itemIndex) => {
                      const parts = item.text.split('\n');
                      const mainText = parts[0];
                      const extraText = parts.slice(1).filter(p => p.trim() && !p.startsWith('- '));
                      return (
                        <div key={itemIndex} className="flex items-start">
                          <div className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-xs font-medium mr-2 mt-0.5 flex-shrink-0">
                            {item.number}
                          </div>
                          <div className="flex-1">
                            <p className="text-gray-600 dark:text-muted-foreground text-sm leading-6 font-inter" dangerouslySetInnerHTML={{ __html: renderInlineFormatting(mainText) }}></p>
                            {extraText.length > 0 && (
                              <div className="mt-1 ml-2 space-y-1">
                                {extraText.map((t, k) => (
                                  <p key={k} className="text-gray-600 dark:text-muted-foreground text-sm leading-6 font-inter" dangerouslySetInnerHTML={{ __html: renderInlineFormatting(t) }}></p>
                                ))}
                              </div>
                            )}
                            {item.subItems.length > 0 && (
                              <div className="mt-1 ml-2 space-y-1">
                                {item.subItems.map((subItem, subIndex) => (
                                  <div key={subIndex} className="flex items-start">
                                    <div className="w-1 h-1 bg-gray-400 rounded-full mr-2 mt-2 flex-shrink-0"></div>
                                    <p className="text-gray-600 dark:text-muted-foreground text-sm leading-6 font-inter" dangerouslySetInnerHTML={{ __html: renderInlineFormatting(subItem) }}></p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            
            return <div key={index}>{elements}</div>;
          }

          // Regular paragraph
          return (
            <div key={index} className="mb-2">
              <p className="text-gray-600 dark:text-muted-foreground text-sm leading-6 font-inter" dangerouslySetInnerHTML={{ __html: renderInlineFormatting(trimmedSection) }}></p>
            </div>
          );
        })}
      </div>
    );
  };

  return renderArticleContent(content);
};

export default ArticleRenderer;
