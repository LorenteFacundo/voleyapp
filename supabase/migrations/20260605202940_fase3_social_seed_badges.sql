INSERT INTO public.badges_catalogo (id, nombre, descripcion, icono) VALUES
  ('primer_partido', 'Debut', 'Creaste o te uniste a tu primer partido', 'Volleyball'),
  ('racha_3', 'Racha de 3', 'Jugaste 3 partidos consecutivos sin abandonar', 'Flame'),
  ('organizador_nato', 'Organizador nato', 'Creaste 5 o más partidos', 'Star'),
  ('sociable', 'Sociable', 'Te uniste a 10 o más partidos', 'Users'),
  ('veterano', 'Veterano', 'Participaste en 25 o más partidos', 'Trophy'),
  ('nivel_alto', 'Nivel competitivo', 'Alcanzaste nivel de vóley 8 o superior', 'Zap')
ON CONFLICT (id) DO NOTHING;
