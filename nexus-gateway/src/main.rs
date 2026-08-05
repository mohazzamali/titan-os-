use crossterm::{
    event::{self, Event, KeyCode},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout, Alignment},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, List, ListItem},
    Terminal, Frame,
};
use std::{io, net::TcpStream, io::Write, time::Duration};

fn main() -> Result<(), io::Error> {
    // Terminal Setup
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let mut logs = vec![
        "SYSTEM ONLINE.".to_string(),
        "ESTABLISHING SECURE CONNECTION TO SWARM...".to_string(),
        "WAITING FOR DIRECTIVES...".to_string(),
    ];

    // Main Event Loop
    loop {
        terminal.draw(|f| draw_ui(f, &logs))?;

        if event::poll(Duration::from_millis(100))? {
            if let Event::Key(key) = event::read()? {
                match key.code {
                    KeyCode::Char('q') => {
                        break; 
                    }
                    KeyCode::Char('d') => {
                        // 🚀 FIRE THE PAYLOAD TO THE OS
                        logs.push("> INITIATING DEPLOYMENT TO BARE-METAL NODE...".to_string());
                        
                        let wasm_payload: [u8; 40] = [
                            0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 
                            0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f,       
                            0x03, 0x02, 0x01, 0x00,                         
                            0x07, 0x0b, 0x01, 0x07, 0x65, 0x78, 0x65, 0x63, 
                            0x75, 0x74, 0x65, 0x00, 0x00, 
                            0x0a, 0x06, 0x01, 0x04, 0x00, 0x41, 0x01, 0x0b  
                        ];

                        match TcpStream::connect("127.0.0.1:9999") {
                            Ok(mut stream) => {
                                if stream.write_all(&wasm_payload).is_ok() {
                                    logs.push("[OK] PAYLOAD INJECTED VIA DPI FIREWALL!".to_string());
                                } else {
                                    logs.push("[ERROR] FAILED TO WRITE TO SOCKET.".to_string());
                                }
                            }
                            Err(_) => {
                                logs.push("[ERROR] NODE OFFLINE. IS NEXUS OS RUNNING?".to_string());
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    // Terminal Teardown
    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;
    Ok(())
}

fn draw_ui(f: &mut Frame, logs: &[String]) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .margin(2)
        .constraints([Constraint::Length(3), Constraint::Min(10), Constraint::Length(3)])
        .split(f.size());

    // --- HEADER ---
    let header = Paragraph::new(Line::from(vec![
        Span::styled("⚡ NEXUS TITAN ", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
        Span::styled(":: GLOBAL DEPLOYMENT GATEWAY", Style::default().fg(Color::DarkGray)),
    ]))
    .alignment(Alignment::Center)
    .block(Block::default().borders(Borders::ALL).style(Style::default().fg(Color::Cyan)));
    f.render_widget(header, chunks[0]);

    // --- MAIN SPLIT (METRICS + LOGS) ---
    let middle_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(30), Constraint::Percentage(70)])
        .split(chunks[1]);

    // METRICS PANEL
    let metrics = vec![
        ListItem::new("Nodes Online : 1 (Local)"),
        ListItem::new("Network TVL  : 930 NXC"),
        ListItem::new("Trust Score  : 100%"),
        ListItem::new(""),
        ListItem::new("Wasm Jail    : SECURED"),
        ListItem::new("W^X Memory   : LOCKED"),
    ];
    let metrics_list = List::new(metrics)
        .block(Block::default().title(" SWARM METRICS ").borders(Borders::ALL).style(Style::default().fg(Color::Green)));
    f.render_widget(metrics_list, middle_chunks[0]);

    // LOGS PANEL
    let log_items: Vec<ListItem> = logs.iter().map(|l| ListItem::new(l.as_str())).collect();
    let logs_list = List::new(log_items)
        .block(Block::default().title(" DEPLOYMENT LOGS ").borders(Borders::ALL).style(Style::default().fg(Color::Yellow)));
    f.render_widget(logs_list, middle_chunks[1]);

    // --- FOOTER COMMANDS ---
    let footer = Paragraph::new("Press [d] to Deploy Wasm Payload  |  Press [q] to Quit")
        .alignment(Alignment::Center)
        .block(Block::default().borders(Borders::ALL).style(Style::default().fg(Color::DarkGray)));
    f.render_widget(footer, chunks[2]);
}
