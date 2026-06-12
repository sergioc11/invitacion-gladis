-- Script para crear la tabla de invitados y configurar los permisos en Supabase.
-- Puedes copiar y pegar todo este script en el Editor SQL de tu panel de Supabase.

-- 1. Crear la tabla de invitados
CREATE TABLE IF NOT EXISTS invitados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_completo TEXT NOT NULL,                   -- Nombre completo del invitado para la búsqueda
  codigo_acceso TEXT NOT NULL,                     -- Código/PIN de 4 dígitos para seguridad (ej: "1234")
  numero_mesa TEXT,                                -- Número o nombre de la mesa asignada (ej: "Mesa 4" o "Mesa Familiar")
  pases_totales INTEGER DEFAULT 1,                 -- Pases permitidos para este grupo/invitado
  confirmado BOOLEAN DEFAULT NULL,                 -- NULL = Sin responder, TRUE = Asistirá, FALSE = No asistirá
  asistentes_confirmados INTEGER DEFAULT 0,         -- Cantidad de personas que asistirán realmente
  comentarios TEXT,                                -- Mensaje o felicitación opcional para la festejada
  fecha_confirmacion TIMESTAMP WITH TIME ZONE,     -- Fecha y hora de la confirmación
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Crear un índice para optimizar las búsquedas de nombres (búsqueda insensible a mayúsculas/minúsculas)
CREATE INDEX IF NOT EXISTS idx_invitados_nombre ON invitados (lower(nombre_completo));

-- 2. Habilitar la seguridad a nivel de fila (Row Level Security - RLS)
ALTER TABLE invitados ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas para permitir que la página web acceda y actualice los datos sin requerir inicio de sesión
-- NOTA: Supabase usa la Anon Key para estas consultas web públicas.

-- Política de lectura: cualquiera puede consultar los nombres de la lista para buscarse
CREATE POLICY "Permitir lectura publica de invitados" ON invitados
  FOR SELECT
  USING (true);

-- Política de actualización: cualquiera puede actualizar su confirmación
CREATE POLICY "Permitir actualizacion de confirmacion" ON invitados
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 4. Insertar datos de prueba para verificar el funcionamiento inicial
-- Nota: Puedes eliminar estos registros una vez que agregues tu lista oficial.
INSERT INTO invitados (nombre_completo, codigo_acceso, numero_mesa, pases_totales) VALUES
  ('Sergio Castellanos', '1234', 'Mesa 1', 3),
  ('María de los Ángeles Estrada', '5678', NULL, 2), -- Sin mesa asignada inicialmente (Mesa: null)
  ('Juan Carlos Pérez', '4321', 'Mesa 3', 4),
  ('Gladis Elizabeth Ruano Estrada', '7070', 'Mesa de Honor', 1),
  ('Familiar Ruano', '9999', NULL, 5) -- Sin mesa asignada inicialmente (Mesa: null)
ON CONFLICT (id) DO NOTHING;

-- 5. Políticas adicionales para el panel administrativo público
-- Política de inserción: permite que el panel agregue nuevos invitados
CREATE POLICY "Permitir insercion publica de invitados" ON invitados
  FOR INSERT
  WITH CHECK (true);

-- Política de eliminación: permite que el panel borre invitados
CREATE POLICY "Permitir eliminacion publica de invitados" ON invitados
  FOR DELETE
  USING (true);

