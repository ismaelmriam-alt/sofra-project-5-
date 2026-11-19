import { Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import Home from './pages/Home.jsx';
import Menu from './pages/Menu.jsx';
import Checkout from './pages/Checkout.jsx';
import OrderConfirmation from './pages/OrderConfirmation.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import MyAccount from './pages/MyAccount.jsx';
import Reservations from './pages/Reservations.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import Overview from './pages/admin/Overview.jsx';
import DishesAdmin from './pages/admin/DishesAdmin.jsx';
import CategoriesAdmin from './pages/admin/CategoriesAdmin.jsx';
import OrdersAdmin from './pages/admin/OrdersAdmin.jsx';
import ReservationsAdmin from './pages/admin/ReservationsAdmin.jsx';
import ReservationSettingsAdmin from './pages/admin/ReservationSettingsAdmin.jsx';

function ScrollTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => { if (!hash) window.scrollTo(0, 0); }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ScrollTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/:orderId" element={<OrderConfirmation />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/account" element={<ProtectedRoute><MyAccount /></ProtectedRoute>} />
          <Route path="/reservations" element={<Reservations />} />
          <Route path="*" element={<main className="page container narrow center"><h1 className="serif">Page not found</h1><a className="btn btn-primary" href="/">Go home</a></main>} />
        </Route>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Overview />} />
          <Route path="dishes" element={<DishesAdmin />} />
          <Route path="categories" element={<CategoriesAdmin />} />
          <Route path="orders" element={<OrdersAdmin />} />
          <Route path="reservations" element={<ReservationsAdmin />} />
          <Route path="reservation-settings" element={<ReservationSettingsAdmin />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
