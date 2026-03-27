import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import PrivateRoute from './components/PrivateRoute'
import Dashboard from './pages/Dashboard'
import Indicators from './pages/Indicators'
import Symptoms from './pages/Symptoms'
import Medications from './pages/Medications'
import APSPage from './pages/APS'
import Visits from './pages/Visits'
import Upload from './pages/Upload'
import Login from './pages/Login'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="indicators" element={<Indicators />} />
          <Route path="symptoms" element={<Symptoms />} />
          <Route path="medications" element={<Medications />} />
          <Route path="aps" element={<APSPage />} />
          <Route path="visits" element={<Visits />} />
          <Route path="upload" element={<Upload />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
