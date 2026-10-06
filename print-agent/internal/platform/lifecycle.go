package platform

import (
	"errors"
	"fmt"

	"github.com/kardianos/service"
)

const serviceName = "ZettazPrintAgent"

type managedProgram struct {
	start func() error
	stop  func() error
}

func (p *managedProgram) Start(service.Service) error { go func() { _ = p.start() }(); return nil }
func (p *managedProgram) Stop(service.Service) error  { return p.stop() }

func configuration() *service.Config {
	return &service.Config{
		Name: serviceName,
		DisplayName: "Zettaz Print Agent",
		Description: "Local secure print service for Zettaz applications",
		Option: service.KeyValue{"UserService": true},
	}
}

func RunManaged(start, stop func() error) error {
	program := &managedProgram{start: start, stop: stop}
	managed, err := service.New(program, configuration())
	if err != nil { return err }
	return managed.Run()
}

func IsInteractive() bool { return service.Interactive() }

func Run(args []string) error {
	if len(args) == 0 { return errors.New("usage: zettaz-print-agent service <install|uninstall|start|stop|restart|status>") }
	managed, err := service.New(&managedProgram{start: func() error { return nil }, stop: func() error { return nil }}, configuration())
	if err != nil { return err }
	command := args[0]
	if command == "status" {
		status, err := managed.Status()
		if err != nil { return err }
		fmt.Println(status)
		return nil
	}
	if command == "restart" {
		_ = service.Control(managed, "stop")
		return service.Control(managed, "start")
	}
	for _, allowed := range []string{"install", "uninstall", "start", "stop"} {
		if command == allowed { return service.Control(managed, command) }
	}
	return fmt.Errorf("unknown service command %q", command)
}
