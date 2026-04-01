import { useEffect, useState } from 'react';
import { AlertTriangle, XCircle, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { complianceService, LicenceAlert } from '@/services/complianceService';

const LEVEL_STYLES: Record<string, { bg: string; text: string; border: string; Icon: React.ElementType }> = {
  expired:  { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-300',    Icon: XCircle },
  critical: { bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200',    Icon: XCircle },
  warning:  { bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200',  Icon: AlertTriangle },
  info:     { bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200',   Icon: Info },
};

export function LicenceAlertBanner() {
  const [alerts, setAlerts] = useState<LicenceAlert[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    complianceService.getLicenceAlerts()
      .then(r => setAlerts(r.alerts))
      .catch(() => {}); // silent — banner is non-critical
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {alerts.map(alert => {
        const style = LEVEL_STYLES[alert.level] ?? LEVEL_STYLES.info;
        const { Icon } = style;
        return (
          <div key={alert.key}
            className={`flex items-center justify-between rounded-xl px-4 py-3 border ${style.bg} ${style.text} ${style.border}`}>
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium">
                {alert.label}:{' '}
                {alert.days_left <= 0
                  ? 'EXPIRED'
                  : `expires in ${alert.days_left} day${alert.days_left === 1 ? '' : 's'}`}{' '}
                ({alert.expiry_date})
              </span>
            </div>
            <button
              onClick={() => navigate('/compliance')}
              className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100">
              Update
            </button>
          </div>
        );
      })}
    </div>
  );
}
