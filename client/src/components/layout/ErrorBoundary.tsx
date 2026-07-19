import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../../services/errorReporting';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

// Last line of defense: if any render throws, show a branded recovery screen
// instead of a blank white page.
export default class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        // Surface in the console for debugging, and ship to Sentry when configured.
        console.error('Render error caught by ErrorBoundary:', error, info.componentStack);
        reportError(error, { componentStack: info.componentStack });
    }

    private handleReload = (): void => {
        this.setState({ hasError: false });
        window.location.assign('/');
    };

    render(): ReactNode {
        if (!this.state.hasError) return this.props.children;

        return (
            <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
                <p className="label-xs mb-3 text-accent">Something broke</p>
                <h1 className="font-heading text-[clamp(2rem,6vw,3.4rem)] leading-[0.95] text-text-1">
                    That wasn't supposed to happen.
                </h1>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-text-3">
                    A hiccup on our end took this screen down. Your progress is safe — let's get you back to the music.
                </p>
                <button
                    type="button"
                    onClick={this.handleReload}
                    className="btn-primary mt-8 rounded-[1rem] px-6 py-3 text-sm"
                >
                    Back to start
                </button>
            </div>
        );
    }
}
