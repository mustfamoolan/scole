import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@/components/ui';
import { X } from 'lucide-react';

export type AppModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

export interface AppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: AppModalSize;
  className?: string;
  bodyClassName?: string;
  dir?: 'rtl' | 'ltr';
  showCloseButton?: boolean;
  onSubmit?: (e: React.FormEvent) => void;
  formId?: string;
}

const sizeClasses: Record<AppModalSize, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',      // Spacious for modern forms
  xl: 'sm:max-w-4xl',      // Wide for multi-column grids
  '2xl': 'sm:max-w-5xl',    // Extra wide for advanced tools
  full: 'sm:max-w-[95vw] h-[92vh]',
};

export const AppModal: React.FC<AppModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  icon: IconOrElement,
  badge,
  children,
  footer,
  size = 'lg',
  className = '',
  bodyClassName = '',
  dir = 'rtl',
  showCloseButton = true,
  onSubmit,
  formId,
}) => {
  const renderIcon = () => {
    if (!IconOrElement) return null;
    if (React.isValidElement(IconOrElement)) {
      return (
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {IconOrElement}
        </div>
      );
    }
    const IconComponent = IconOrElement as React.ElementType;
    return (
      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <IconComponent className="w-5 h-5" />
      </div>
    );
  };

  const renderContent = () => (
    <>
      {/* Modal Body with smooth scrolling */}
      <div className={`px-6 py-5 max-h-[75vh] overflow-y-auto space-y-4 text-xs font-normal ${bodyClassName}`}>
        {children}
      </div>

      {/* Unified Modal Footer */}
      {footer && (
        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-secondary/15 flex flex-row items-center justify-end gap-2.5">
          {footer}
        </DialogFooter>
      )}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`w-full ${sizeClasses[size]} p-0 gap-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-card transition-all duration-200 ${className}`}
        dir={dir}
      >
        {/* Unified Modal Header */}
        <div className="px-6 py-4 border-b border-border/80 bg-secondary/15 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {renderIcon()}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base font-black text-foreground tracking-tight">
                  {title}
                </DialogTitle>
                {badge && <div className="shrink-0">{badge}</div>}
              </div>
              {description && (
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 leading-relaxed truncate sm:text-clip">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>

          {showCloseButton && (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors shrink-0"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {onSubmit ? (
          <form id={formId} onSubmit={onSubmit} className="contents">
            {renderContent()}
          </form>
        ) : (
          renderContent()
        )}
      </DialogContent>
    </Dialog>
  );
};
