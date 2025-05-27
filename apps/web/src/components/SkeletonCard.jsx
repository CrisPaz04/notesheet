// apps/web/src/components/SkeletonCard.jsx

function SkeletonCard({ type = "song" }) {
    if (type === "song") {
      return (
        <div className="skeleton-card">
          <div className="skeleton skeleton-header"></div>
          <div className="skeleton skeleton-line medium"></div>
          <div className="skeleton skeleton-line short"></div>
          <div className="skeleton skeleton-line" style={{ marginTop: '1rem' }}></div>
        </div>
      );
    }
  
    if (type === "action") {
      return (
        <div className="skeleton-card" style={{ textAlign: 'center', minHeight: '140px' }}>
          <div className="skeleton" style={{ 
            width: '60px', 
            height: '60px', 
            borderRadius: '50%', 
            margin: '0 auto 1rem auto' 
          }}></div>
          <div className="skeleton skeleton-line medium" style={{ margin: '0 auto 0.5rem auto' }}></div>
          <div className="skeleton skeleton-line short" style={{ margin: '0 auto' }}></div>
        </div>
      );
    }
  
    return (
      <div className="skeleton-card">
        <div className="skeleton skeleton-header"></div>
        <div className="skeleton skeleton-line"></div>
        <div className="skeleton skeleton-line medium"></div>
        <div className="skeleton skeleton-line short"></div>
      </div>
    );
  }
  
  // Componente para mostrar múltiples skeletons
  export function SkeletonGrid({ count = 4, type = "song" }) {
    return (
      <div className={type === "action" ? "action-grid" : "recent-grid"}>
        {Array.from({ length: count }, (_, index) => (
          <SkeletonCard key={index} type={type} />
        ))}
      </div>
    );
  }
  
  export default SkeletonCard;