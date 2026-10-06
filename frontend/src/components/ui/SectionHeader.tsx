import React from 'react';

// Small section header shared across product form sections (Basic Info,
// Pricing, Inventory, Identifiers, industry attributes, ...) so every
// section — including dynamically-injected ones like DynamicProductFields —
// renders with the same icon + label + divider treatment. Extracted out of
// ProductFormModal.tsx to avoid a circular import with DynamicProductFields.tsx.
const SectionHeader: React.FC<{ icon: React.ElementType; title: string }> = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-2 mb-3">
    <Icon className="h-3.5 w-3.5 text-primary/70 shrink-0" />
    <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-muted-foreground">{title}</span>
    <div className="flex-1 h-px bg-border" />
  </div>
);

export default SectionHeader;
