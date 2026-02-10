import { Mic } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { useState, useEffect } from 'react';

interface MicrophoneButtonProps {
    onClick?: () => void;
    isRecording?: boolean;
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
}

export function MicrophoneButton({
    onClick,
    isRecording = false,
    size = 'lg',
    disabled = false
}: MicrophoneButtonProps) {
    const [ripples, setRipples] = useState<number[]>([]);

    useEffect(() => {
        if (isRecording) {
            const interval = setInterval(() => {
                setRipples(prev => [...prev, Date.now()]);
            }, 800);
            return () => clearInterval(interval);
        } else {
            setRipples([]);
        }
    }, [isRecording]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setRipples(prev => prev.filter(r => Date.now() - r < 2000));
        }, 100);
        return () => clearTimeout(timeout);
    }, [ripples]);

    const sizes = {
        sm: 'w-14 h-14',
        md: 'w-20 h-20',
        lg: 'w-28 h-28',
    };

    const iconSizes = {
        sm: 'w-6 h-6',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
    };

    return (
        <div className="relative flex items-center justify-center">
            {/* Ripple Effects */}
            {isRecording && ripples.map((ripple, i) => (
                <div
                    key={ripple}
                    className={cn(
                        'absolute rounded-full border-2 border-blue-400 animate-ping',
                        sizes[size]
                    )}
                    style={{
                        animationDuration: '2s',
                        animationDelay: `${i * 0.2}s`
                    }}
                />
            ))}

            {/* Button */}
            <button
                onClick={onClick}
                disabled={disabled}
                className={cn(
                    'relative rounded-full flex items-center justify-center transition-all duration-300',
                    'shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95',
                    sizes[size],
                    isRecording
                        ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-200'
                        : 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-200',
                    disabled && 'opacity-50 cursor-not-allowed hover:scale-100'
                )}
            >
                {/* Inner glow */}
                <div className={cn(
                    'absolute inset-2 rounded-full opacity-30',
                    isRecording ? 'bg-red-300' : 'bg-blue-300'
                )} />

                {/* Icon */}
                <Mic className={cn(
                    'relative z-10 text-white',
                    iconSizes[size],
                    isRecording && 'animate-pulse'
                )} />
            </button>

            {/* Recording indicator */}
            {isRecording && (
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="text-red-500 font-semibold text-sm animate-pulse">
                        Recording...
                    </span>
                </div>
            )}
        </div>
    );
}
