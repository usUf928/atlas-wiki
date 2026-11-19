import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { HomePage } from './pages/Home';
import { WikiPage } from './pages/WikiPage';
import { HistoryPage } from './pages/History';
import { EditPage } from './pages/Edit';
import { SearchPage } from './pages/Search';
import { CategoryPage } from './pages/Category';
import { CategoriesPage } from './pages/Categories';
import { TagPage } from './pages/Tag';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { UserProfilePage } from './pages/UserProfile';
import { AdminPage } from './pages/admin/AdminPage';
import { ForbiddenPage, NotFoundPage, ServerErrorPage } from './pages/ErrorPages';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="wiki/:slug" element={<WikiPage />} />
        <Route path="wiki/:slug/history" element={<HistoryPage />} />
        <Route
          path="wiki/:slug/edit"
          element={
            <RequireAuth>
              <EditPage />
            </RequireAuth>
          }
        />
        <Route
          path="new"
          element={
            <RequireAuth>
              <EditPage />
            </RequireAuth>
          }
        />
        <Route path="search" element={<SearchPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="category/:id" element={<CategoryPage />} />
        <Route path="tags/:tag" element={<TagPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="u/:username" element={<UserProfilePage />} />
        <Route
          path="admin"
          element={
            <RequireAuth>
              <AdminPage />
            </RequireAuth>
          }
        />
        <Route path="403" element={<ForbiddenPage />} />
        <Route path="500" element={<ServerErrorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
