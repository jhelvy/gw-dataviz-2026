library(tidyverse)
library(cowplot)
library(here)
library(readxl)
library(janitor)
library(waffle)
options(dplyr.width = Inf)

font <- 'Roboto Condensed'

my_theme <- function() {
  theme_minimal_grid(font_family = font, font_size = 16) +
    theme(
      strip.background = element_rect("grey80"),
      panel.grid.minor = element_blank(),
      plot.title.position = "plot",
      legend.position = c(0.02, 0.88),
      legend.justification = c(0, 1),
      legend.background = element_rect(
        fill = "white",
        color = "black",
        size = 0.2
      ),
      legend.margin = margin(6, 6, 6, 6),
      panel.background = element_rect(fill = 'white', color = NA),
      plot.background = element_rect(fill = 'white', color = NA)
    ) +
    panel_border()
}

data <- read_excel(
  here('data', 'loop-data-ldw-2026.xlsx'),
  sheet = 'Data (Jan-Oct 25)'
) %>%
  clean_names() %>%
  rename(date = visit_date) %>%
  pivot_longer(
    names_to = 'type',
    values_to = 'n',
    cols = tops:accessories
  ) %>%
  mutate(
    n = ifelse(is.na(n), 0, n),
    demos = fct_other(demographics, keep = c('Undergraduate', 'Graduate')),
    date = ymd(date)
  ) %>%
  filter(date < ymd('2025-10-01'))

data_type <- data %>%
  group_by(type) %>%
  summarise(n = sum(n)) %>%
  mutate(type = fct_reorder(type, n))

data_demo <- data %>%
  group_by(demos) %>%
  summarise(n = sum(n)) %>%
  mutate(demos = fct_reorder(demos, n))

data_type_demo <- data %>%
  group_by(type, demos) %>%
  summarise(n = sum(n)) %>%
  mutate(type = fct_reorder(type, n))

# Proportions

data_type_demo %>%
  group_by(type, demos) %>%
  summarise(n = sum(n)) %>%
  mutate(type = fct_reorder(type, n)) %>%
  ggplot() +
  geom_col(
    aes(
      x = n,
      y = type
    )
  ) +
  facet_wrap(vars(demos)) +
  my_theme()

data_demo %>%
  ggplot() +
  geom_col(
    aes(
      x = n,
      y = demos
    )
  ) +
  my_theme()

data_type_demo %>%
  mutate(
    n = n / 10,
    type = str_to_title(type),
    type = fct_reorder(type, n)
  ) %>%
  # geom_waffle() ignores factor levels and arranges the squares
  # based on the way the data frame is sorted
  arrange(desc(n)) %>%
  ggplot() +
  geom_waffle(
    aes(fill = demos, values = n),
    color = "white",
    size = 1,
    n_cols = 10,
    flip = TRUE
  ) +
  facet_wrap(vars(type), nrow = 1) +
  scale_x_discrete(expand = c(0, 0)) +
  scale_y_discrete(expand = c(0, 0)) +
  theme_minimal() +
  labs(
    fill = 'Category',
    x = NULL,
    y = NULL,
    title = 'Tops, Pants, and Sweaters, Oh My!',
    subtitle = '(1 square = 10 items)'
  ) +
  theme_minimal_grid(font_family = font, font_size = 16) +
  theme(
    strip.background = element_rect("grey80"),
    panel.grid.minor = element_blank(),
    plot.title.position = "plot",
    legend.background = element_rect(
      fill = "white",
      color = "black",
      size = 0.2
    ),
    legend.margin = margin(6, 6, 6, 6),
    panel.background = element_rect(fill = 'white', color = NA),
    plot.background = element_rect(fill = 'white', color = NA)
  ) +
  panel_border()

ggsave(
  here('figs', 'waffle.png'),
  width = 15,
  height = 3
)

# Time

data %>%
  filter(n > 0) %>%
  group_by(date, demos) %>%
  summarise(n = sum(n)) %>%
  ggplot() +
  geom_col(
    aes(
      x = date,
      y = n,
      fill = demos
    )
  ) +
  theme_minimal_grid(font_family = font, font_size = 16) +
  theme(
    strip.background = element_rect("grey80"),
    panel.grid.minor = element_blank(),
    plot.title.position = "plot",
    legend.position = 'bottom',
    legend.background = element_rect(
      fill = "white",
      color = "black",
      size = 0.2
    ),
    legend.margin = margin(6, 6, 6, 6),
    panel.background = element_rect(fill = 'white', color = NA),
    plot.background = element_rect(fill = 'white', color = NA)
  ) +
  panel_border() +
  labs(
    fill = 'Demographic',
    x = NULL,
    y = 'Count'
  )

ggsave(
  here('figs', 'bar_time.png'),
  width = 15,
  height = 5
)

# Export summary data for React apps ----

data %>%
  mutate(
    month = floor_date(date, 'month'),
    type = str_to_title(str_replace_all(type, '_', ' '))
  ) %>%
  group_by(month, type) %>%
  summarise(n = sum(n), .groups = 'drop') %>%
  write_csv(here('waffle-time', 'public', 'seasonal.csv'))
