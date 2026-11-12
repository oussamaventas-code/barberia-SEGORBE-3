import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NoiseOverlay } from './components/NoiseOverlay';
import HomePage from './pages/HomePage';
import BookingPage from './pages/BookingPage';
import ClientAreaPage from './pages/ClientAreaPage';
import LegalPages from './pages/LegalPages';
import AdminLayout from './pages/admin/AdminLayout';
import AdminOverview from './pages/admin/AdminOverview';
import AdminAgenda from './pages/admin/AdminAgenda';
import AdminBookingsList from './pages/admin/AdminBookingsList';
import AdminCustomersCrm from './pages/admin/AdminCustomersCrm';
import AdminCatalogTeam from './pages/admin/AdminCatalogTeam';
import AdminReports from './pages/admin/AdminReports';
import AdminSettings from './pages/admin/AdminSettings';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NoiseOverlay />
        <Routes>
          {/* Public Zone */}
          <Route path="/" element={<HomePage />} />
          <Route path="/reservar" element={<BookingPage />} />

          {/* Client Area */}
          <Route path="/mi-cita" element={<ClientAreaPage />} />
          <Route path="/mis-citas" element={<ClientAreaPage />} />

          {/* Legal & RGPD */}
          <Route path="/privacidad" element={<LegalPages docType="privacidad" />} />
          <Route path="/aviso-legal" element={<LegalPages docType="aviso-legal" />} />
          <Route path="/politica-cookies" element={<LegalPages docType="cookies" />} />
          <Route path="/condiciones-reserva" element={<LegalPages docType="cancelacion" />} />

          {/* Private Admin & CRM OS */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="agenda" element={<AdminAgenda />} />
            <Route path="reservas" element={<AdminBookingsList />} />
            <Route path="clientes" element={<AdminCustomersCrm mode="CUSTOMERS" />} />
            <Route path="servicios" element={<AdminCatalogTeam mode="SERVICES" />} />
            <Route path="equipo" element={<AdminCatalogTeam mode="TEAM" />} />
            <Route path="crm" element={<AdminCustomersCrm mode="CRM" />} />
            <Route path="informes" element={<AdminReports />} />
            <Route path="configuracion" element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
