//  interface TicketProps {
//   title: string;
//   description?: string;
//   storyPoints?: number;
//   dependsOn?: Ticket;
//   blocks?: Ticket;
//   assignedTo?: string;
//   status?: any;
//   subTickets?: Ticket[];
// }
//
//  class Ticket implements TicketProps {
//   title: string;
//   description?: string;
//   storyPoints?: number;
//   assignedTo?: string;
//   blocks?: Ticket;
//   dependsOn?: Ticket;
//   status?: any;
//   subTickets: Ticket[] = [];
//
//   static ticketNum: number = 0;
//
//   constructor(props: TicketProps) {
//     Ticket.ticketNum++;
//     this.title = props.title;
//     this.description = props.description;
//     this.storyPoints = props.storyPoints;
//     this.assignedTo = props.assignedTo;
//     this.blocks = props.blocks;
//     this.dependsOn = props.dependsOn;
//     this.status = props.status;
//     this.subTickets = props.subTickets ?? [];
//   }
//
//   addChild(ticket: Ticket) {
//     this.subTickets.push(ticket);
//   }
// }
//
//  class TicketFactory {
//   make(ticketDef: TicketProps) {
//     return new Ticket(ticketDef);
//   }
// }
