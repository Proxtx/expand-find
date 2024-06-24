#[derive(Clone, Debug, PartialEq)]
pub enum CellStatus {
    Start,
    End,
    Block,
    Free,
    Discovered,
}

impl CellStatus {
    pub fn get_color(&self) -> u32 {
        match self {
            CellStatus::Block => from_u8_rgb(0, 0, 0),
            CellStatus::Discovered => from_u8_rgb(255, 0, 0),
            CellStatus::End => from_u8_rgb(0, 255, 0),
            CellStatus::Free => from_u8_rgb(255, 255, 255),
            CellStatus::Start => from_u8_rgb(0, 0, 255),
        }
    }
}

pub struct Maze {
    grid: Vec<Vec<CellStatus>>,
}

impl Maze {
    pub fn new(width: usize, height: usize) -> Self {
        let mut pre_grid = vec![vec![CellStatus::Free; height]; width];
        pre_grid[50] = pre_grid[50].iter().map(|_v| CellStatus::Block).collect();

        Self { grid: pre_grid }
    }

    pub fn get_pixel_buffer(&self) -> Vec<u32> {
        let mut out = Vec::new();
        for column in self.grid.iter() {
            for elem in column.iter() {
                out.push(elem.get_color())
            }
        }

        out
    }
}

fn from_u8_rgb(r: u8, g: u8, b: u8) -> u32 {
    let (r, g, b) = (r as u32, g as u32, b as u32);
    (r << 16) | (g << 8) | b
}
