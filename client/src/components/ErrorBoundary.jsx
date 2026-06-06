import { Component } from "react";

// 렌더링 중 예외가 나도 흰 화면 대신 복구 UI를 보여줌
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
          <p className="text-5xl mb-4">😵</p>
          <h1 className="text-xl font-bold mb-2">문제가 발생했습니다</h1>
          <p className="text-slate-500 mb-6 text-sm">일시적인 오류일 수 있어요. 다시 시도해주세요.</p>
          <div className="flex gap-2">
            <button
              onClick={this.handleReset}
              className="bg-slate-800 text-white px-5 py-2.5 rounded-lg hover:bg-slate-700"
            >
              다시 시도
            </button>
            <a
              href="/"
              className="border border-slate-300 px-5 py-2.5 rounded-lg hover:border-slate-400"
            >
              홈으로
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
