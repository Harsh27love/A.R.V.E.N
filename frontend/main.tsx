import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@xyflow/react/dist/style.css';
import './styles.css';
import { App } from './App';
class ErrorBoundary extends React.Component<{children:React.ReactNode},{error:boolean}> {
  state={error:false};
  static getDerivedStateFromError(){return {error:true};}
  render(){return this.state.error?<main className="boot"><h1>Let’s get you back in flow.</h1><p>The interface encountered an unexpected error. Your saved data is still in the local database.</p><button className="btn btn-primary" onClick={()=>window.location.reload()}>Reload workspace</button></main>:this.props.children;}
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
