// apps/web/src/components/LoadingSpinner.jsx

function LoadingSpinner({ 
    size = "medium", 
    text = "Cargando...", 
    subtext = null,
    fullScreen = false 
  }) {
    const getSizeClass = () => {
      switch (size) {
        case "small":
          return "width: 40px; height: 40px;";
        case "large":
          return "width: 80px; height: 80px;";
        default:
          return "width: 60px; height: 60px;";
      }
    };
  
    const containerClass = fullScreen 
      ? "loading-overlay show" 
      : "loading-container";
  
    return (
      <div className={containerClass}>
        <div 
          className="loading-spinner" 
          style={{ 
            width: size === "small" ? "40px" : size === "large" ? "80px" : "60px",
            height: size === "small" ? "40px" : size === "large" ? "80px" : "60px"
          }}
        ></div>
        <div className="loading-text">{text}</div>
        {subtext && <div className="loading-subtext">{subtext}</div>}
      </div>
    );
  }
  
  export default LoadingSpinner;