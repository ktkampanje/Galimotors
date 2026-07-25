import React from 'react';

interface Category {
  name: string;
  emoji: string;
  color: string;
  bgColor: string;
}

interface CarCategory {
  category: Category;
}

interface CategoryBadgesProps {
  categories?: CarCategory[];
  max?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'text-[10px] px-2 py-1',
  md: 'text-xs px-2.5 py-1.5',
  lg: 'text-sm px-3 py-2',
};

const CategoryBadges: React.FC<CategoryBadgesProps> = ({
  categories = [],
  max = 3,
  className = '',
  size = 'md',
}) => {
  if (!categories || categories.length === 0) return null;

  const displayedCategories = categories.slice(0, max);
  const moreCount = categories.length - max;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {/* Name only, sharp corners — the emoji + rounded-pill treatment read
          as template decoration; these now match the site's other flat
          colored tags (Duty Paid, Blue Book). Sole consumer: detail page. */}
      {displayedCategories.map((item, idx) => (
        <span
          key={idx}
          style={{
            backgroundColor: item.category.bgColor,
            color: item.category.color,
          }}
          className={`inline-flex items-center font-semibold whitespace-nowrap ${sizeClasses[size]}`}
        >
          {item.category.name}
        </span>
      ))}
      {moreCount > 0 && (
        <span
          className={`inline-flex items-center bg-gray-100 text-gray-600 font-semibold whitespace-nowrap ${sizeClasses[size]}`}
        >
          +{moreCount} more
        </span>
      )}
    </div>
  );
};

export default CategoryBadges;
