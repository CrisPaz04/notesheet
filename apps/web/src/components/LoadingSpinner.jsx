// apps/web/src/components/LoadingSpinner.jsx
function LoadingSpinner({ 
  size = "medium", 
  text = "Cargando...", 
  subtext = null,
  fullScreen = false,
  type = "default"
}) {
  const getSizeStyles = () => {
    switch (size) {
      case "small":
        return { width: "40px", height: "40px" };
      case "large":
        return { width: "80px", height: "80px" };
      default:
        return { width: "60px", height: "60px" };
    }
  };

  const containerClass = fullScreen 
    ? "loading-overlay show" 
    : "loading-container";

  const getSpinnerClass = () => {
    switch (type) {
      case "editor":
        return "loading-spinner-editor";
      case "playlist":
        return "loading-spinner-playlist";
      default:
        return "loading-spinner";
    }
  };

  return (
    <div className={containerClass}>
      <div className="loading-content">
        <div 
          className={getSpinnerClass()} 
          style={getSizeStyles()}
        ></div>
        <div className="loading-text">{text}</div>
        {subtext && <div className="loading-subtext">{subtext}</div>}
        
        {/* Dots animation para mejor feedback */}
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  );
}

export default LoadingSpinner;