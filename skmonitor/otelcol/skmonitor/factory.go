package skmonitor

import (
	"context"
	"go.opentelemetry.io/collector/component"
	"go.opentelemetry.io/collector/receiver"
	"go.opentelemetry.io/collector/consumer"
)

var (
	typeStr = component.MustNewType("skmonitor")
)

func createDefaultConfig() component.Config {
	return &Config{}
}

func createTracesReceiver(
	_ context.Context,
	params receiver.CreateSettings,
	baseCfg component.Config,
	consumer consumer.Traces,
) (receiver.Traces, error) {
	logger := params.Logger
	skmonitorCfg := baseCfg.(*Config)

	traceRcvr := &skmonitorReceiver{
		logger:       logger,
		nextConsumer: consumer,
		config:       skmonitorCfg,
	}

	return traceRcvr, nil
}

// NewFactory creates a factory for skmonitor receiver.
func NewFactory() receiver.Factory {
	return receiver.NewFactory(
		typeStr,
		createDefaultConfig,
		receiver.WithTraces(createTracesReceiver, component.StabilityLevelAlpha))
}
